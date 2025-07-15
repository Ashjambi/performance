import { GoogleGenAI, Type } from "@google/genai";
import type { Pillar, KPI, AnalysisResult, CalculationGuide, KPIHistory, Manager, ManagerRole, Recommendation, WhatIfAnalysis, RiskProfile, TimePeriod, ProcedureRiskAssessment } from '../data.tsx';
import { calculateKpiScore, calculatePillarScore, calculateManagerOverallScore, KPI_CATEGORIES, forecastStationScore } from '../data.tsx';
import { toast } from 'react-hot-toast';

// --- Caching and Locking Service ---
const CACHE_PREFIX = 'gemini_cache_';
const apiLocks = new Map<string, Promise<any>>();

const getFromCache = <T,>(key: string): T | null => {
    try {
        const item = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
        if (item) {
            return JSON.parse(item) as T;
        }
    } catch (e) {
        console.error(`Error getting item from cache for key: ${key}`, e);
        sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
    }
    return null;
};

const setInCache = (key: string, data: any): void => {
    try {
        const item = JSON.stringify(data);
        sessionStorage.setItem(`${CACHE_PREFIX}${key}`, item);
    } catch (e) {
        console.error(`Error setting item in cache for key: ${key}`, e);
    }
};

const withLockAndCache = <T,>(key: string, apiCall: () => Promise<T>): Promise<T> => {
    const cachedData = getFromCache<T>(key);
    if (cachedData) {
        const silentKeys = ['smart_summary', 'bulk_risk_profiles'];
        if (!silentKeys.some(k => key.includes(k))) {
             toast.success("تم استرجاع البيانات من الذاكرة المؤقتة.");
        }
        return Promise.resolve(cachedData);
    }

    if (apiLocks.has(key)) {
        return apiLocks.get(key)!;
    }
    
    const promise = apiCall().then(result => {
        setInCache(key, result);
        return result;
    }).finally(() => {
        apiLocks.delete(key);
    });
    
    apiLocks.set(key, promise);
    return promise;
};
// --- End Caching and Locking Service ---

// --- Types ---
export type RootCauseAnalysis = {
    causes: {
        category: string;
        reasons: string[];
    }[];
};

export type PillarDiagnosisResult = {
  analysis: string;
  contributing_managers: {
    manager_name: string;
    reasoning: string;
  }[];
  recommendations: Recommendation[];
};


const getUnitLabel = (unit: KPI['unit'], value: number | string): string => {
  switch (unit) {
    case 'percentage': return '%';
    case 'minutes': return 'دقيقة';
    case 'per_1000_pax': return '/1000 راكب';
    case 'per_1000_mov': return '/1000 حركة';
    case 'incidents': return Number(value) === 1 ? 'حادثة' : 'حوادث';
    case 'score': return 'نقطة';
    case 'currency': return 'ر.س';
    case 'days': return 'أيام';
    default: return '';
  }
};

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        analysis: {
            type: Type.STRING,
            description: "تحليل شامل للأداء باللغة العربية، يسلط الضوء على نقاط القوة والضعف.",
        },
        recommendations: {
            type: Type.ARRAY,
            description: "قائمة من التوصيات القابلة للتنفيذ باللغة العربية، مع تحديد القسم المستهدف لكل توصية.",
            items: {
                type: Type.OBJECT,
                properties: {
                    text: {
                        type: Type.STRING,
                        description: "نص التوصية.",
                    },
                    targetRole: {
                        type: Type.STRING,
                        enum: ['RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'],
                        description: "القسم المستهدف للتوصية. يجب أن يكون أحد الخيارات التالية: 'RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'.",
                    },
                },
                required: ["text", "targetRole"],
            },
        },
    },
    required: ["analysis", "recommendations"],
};


export const generatePerformanceAnalysis = (manager: Manager, timePeriod: TimePeriod): Promise<AnalysisResult> => {
    const cacheKey = `analysis_${manager.id}_${timePeriod}`;
    
    const apiCall = async () => {
        const overallScore = calculateManagerOverallScore(manager.pillars);
        const performanceSummary = `
            النتيجة الإجمالية للمدير هي ${overallScore}%.

            فيما يلي تفصيل الأداء حسب كل ركيزة:
            ${manager.pillars.map(pillar => {
                const pillarScore = calculatePillarScore(pillar);
                return `
    - ركيزة "${pillar.name}" (الوزن: ${pillar.weight}%, نتيجة الركيزة: ${pillarScore}%):
    ${pillar.kpis.map(kpi => {
        const score = Math.round(calculateKpiScore(kpi));
        const performanceStatus = score >= 100 ? 'أفضل من الهدف' : score >= 90 ? 'يحقق الهدف' : 'أقل من الهدف';
        return `  - ${kpi.name}: القيمة الحالية (${kpi.value.toLocaleString()} ${getUnitLabel(kpi.unit, kpi.value)}), الهدف (${kpi.target.toLocaleString()} ${getUnitLabel(kpi.unit, kpi.target)}), الحالة: ${performanceStatus}.`;
    }).join('\n')}
                `;
            }).join('\n')}
        `;

        const prompt = `
            يرجى تحليل بيانات الأداء التالية لمدير المناولة الأرضية **${manager.name}**.
            ${performanceSummary}
            
            المطلوب:
            1.  قدم تحليلاً شاملاً لأداء **${manager.name}**، مسلطًا الضوء على نقاط القوة الرئيسية ومجالات التحسين الرئيسية بناءً على البيانات.
            2.  قدم قائمة من 3 إلى 5 توصيات محددة وواضحة وقابلة للتنفيذ لمساعدة **${manager.name}** على تحسين أدائه. لكل توصية، حدد القسم المستهدف المسؤول عن تنفيذها، بالاختيار من: ['RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'].
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت مستشار خبير متخصص في عمليات المناولة الأرضية للطيران. مهمتك هي تحليل بيانات أداء مدير وتقديم ملخص للنتائج وتوصيات قابلة للتنفيذ. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    }
    
    return withLockAndCache(cacheKey, apiCall);
};

export const generateExecutiveAnalysis = (
    managersForDisplay: Manager[],
    timePeriod: TimePeriod
): Promise<AnalysisResult> => {
    const cacheKey = `exec_analysis_${timePeriod}`;
    
    const apiCall = async () => {
        const stationOverallScore = (() => {
            if (managersForDisplay.length === 0) return 0;
            const totalScore = managersForDisplay.reduce((acc, manager) => acc + calculateManagerOverallScore(manager.pillars), 0);
            return Math.round(totalScore / managersForDisplay.length);
        })();

        const pillarPerformanceData = (() => {
            const pillarScores = new Map<string, { totalScore: number; count: number; name: string, id: string }>();
            managersForDisplay.forEach(manager => {
                manager.pillars.forEach(pillar => {
                    const score = calculatePillarScore(pillar);
                    const current = pillarScores.get(pillar.id) || { totalScore: 0, count: 0, name: pillar.name, id: pillar.id };
                    pillarScores.set(pillar.id, {
                        ...current,
                        totalScore: current.totalScore + score,
                        count: current.count + 1,
                    });
                });
            });
            return Array.from(pillarScores.values()).map(p => ({
                id: p.id,
                name: p.name,
                score: Math.round(p.totalScore / p.count),
            }));
        })();

        const kpiRanking = (() => {
            const kpiMap = new Map<string, { scores: number[], name: string, targetRoles: Set<ManagerRole> }>();
            managersForDisplay.forEach(manager => {
                manager.pillars.forEach(pillar => {
                    pillar.kpis.forEach(kpi => {
                        if (!kpiMap.has(kpi.id)) {
                            kpiMap.set(kpi.id, { scores: [], name: kpi.name, targetRoles: new Set() });
                        }
                        const kpiEntry = kpiMap.get(kpi.id)!;
                        kpiEntry.scores.push(calculateKpiScore(kpi));
                        kpiEntry.targetRoles.add(manager.role);
                    });
                });
            });
            const rankedKpis = Array.from(kpiMap.entries()).map(([id, data]) => {
                const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
                return { id, name: data.name, score: Math.round(avgScore) };
            });
            rankedKpis.sort((a, b) => a.score - b.score);
            return {
                bottom: rankedKpis.slice(0, 5),
                top: rankedKpis.slice(-5).reverse(),
            };
        })();
        
        const managerPerformanceData = (() => {
            return managersForDisplay
                .map(manager => ({
                    id: manager.id,
                    name: manager.name,
                    score: calculateManagerOverallScore(manager.pillars),
                }))
                .sort((a, b) => b.score - a.score);
        })();


        const performanceSummary = `
            ملخص أداء المحطة:
            - النتيجة الإجمالية للمحطة: ${stationOverallScore}%
            - الأداء حسب الركيزة (متوسط):
            ${pillarPerformanceData.map(p => `  - ${p.name}: ${p.score}%`).join('\n')}
            - أداء المدراء الفردي:
            ${managerPerformanceData.map(m => `  - ${m.name}: ${m.score}%`).join('\n')}
            - أبرز نقاط القوة (أعلى أداءً):
            ${kpiRanking.top.map(k => `  - ${k.name}: متوسط أداء ${k.score}%`).join('\n')}
            - أبرز مجالات التحسين (أدنى أداءً):
            ${kpiRanking.bottom.map(k => `  - ${k.name}: متوسط أداء ${k.score}%`).join('\n')}
        `;

        const prompt = `
            بصفتك الرئيس التنفيذي للعمليات (COO) في شركة عالمية للمناولة الأرضية، قم بتحليل موجز الأداء التالي لمحطة كاملة.
            ${performanceSummary}

            المطلوب:
            1.  قدم تحليلاً استراتيجياً موجزاً للأداء العام للمحطة، مع التركيز على الاتجاهات العامة بدلاً من النتائج الفردية.
            2.  اقترح 3-4 توصيات استراتيجية رفيعة المستوى. لكل توصية، حدد القسم (الدور الوظيفي) الأكثر صلة بتنفيذها. الأدوار المتاحة هي: ['RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'].
            يجب أن يكون الرد باللغة العربية، وبتنسيق JSON حصريًا.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت خبير استراتيجي في عمليات الطيران. مهمتك هي تحليل بيانات أداء محطة كاملة وتقديم رؤى وتوصيات استراتيجية عالية المستوى. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };

    return withLockAndCache(cacheKey, apiCall);
};


export const generateCalculationGuide = (kpi: KPI): Promise<CalculationGuide> => {
    const cacheKey = `guide_${kpi.id}`;

    const apiCall = async () => {
        const prompt = `
            أنت خبير استشاري في عمليات المناولة الأرضية وإدارة الأداء. مهمتك هي تقديم دليل واضح ومفصل، خطوة بخطوة، لمدير حول كيفية حساب مؤشر أداء رئيسي (KPI) معين. يجب أن يكون الدليل عمليًا وسهل المتابعة وموجهًا لمدير يحتاج إلى جمع البيانات وإجراء الحساب على أساس شهري ليتم مقارنته بالهدف الشهري.

            فيما يلي معلومات حول مؤشر الأداء الرئيسي:
            - الاسم: "${kpi.name}"
            - الهدف الشهري: ${kpi.target}
            - الوصف: "${kpi.tooltip.description}"
            - مصدر البيانات: "${kpi.tooltip.dataSource}"
            - هل القيمة الأقل أفضل؟: ${kpi.lowerIsBetter ? 'نعم' : 'لا'}

            المطلوب:
            1.  **inputFields**: قدم قائمة بحقول الإدخال المطلوبة من المدير لإجراء الحساب. **نقطة مهمة جداً: يجب أن تكون حقول الإدخال للبيانات المجمعة على مدار شهر كامل، وليس لرحلة واحدة.** على سبيل المثال، لحساب "متوسط وقت تسليم الحقيبة"، يجب أن تكون حقول الإدخال "إجمالي دقائق تسليم الحقائب لكل الرحلات خلال الشهر" و "العدد الإجمالي للرحلات خلال الشهر".
            2.  **formula**: حدد بنية الصيغة الرياضية المستخدمة. حدد 'name' من أحد الخيارات التالية فقط:
                - 'division_percent' (لنسبة مئوية من قسمة قيمتين، مثل: (الرحلات في الوقت المحدد / إجمالي الرحلات) * 100)
                - 'rate_per_1000' (لحساب معدل لكل 1000، مثل: (عدد الحقائب المفقودة / إجمالي الركاب) * 1000)
                - 'average' (لمتوسط بسيط، مثل: إجمالي الوقت / إجمالي عدد العناصر)
                - 'simple_value' (عندما تكون القيمة النهائية مدخلة مباشرة، مثل نتيجة تدقيق)
                ثم حدد معرفات الحقول المستخدمة بالترتيب الصحيح في 'input_ids'.
            3.  قدم بقية المعلومات (title, objective, required_data, steps, example, tip) باللغة العربية. يجب أن يوضح المثال الحساب على أساس شهري.

            يجب أن يكون الرد بتنسيق JSON حصريًا.
        `;

        const schema = {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING, description: 'عنوان واضح وموجز لدليل الحساب. مثال: "كيفية حساب متوسط وقت خدمة الطائرة (TAT)"' },
                objective: { type: Type.STRING, description: 'وصف للهدف من هذا المؤشر وماذا يقيس باللغة العربية.' },
                required_data: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'قائمة بالبيانات المحددة التي يحتاجها المدير لجمعها. مثال: ["إجمالي وقت خدمة الطائرة بالدقائق لجميع الرحلات", "إجمالي عدد الرحلات التي تمت خدمتها"]' },
                steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'قائمة بالخطوات المرقمة التي يجب على المدير اتباعها لإجراء الحساب. يجب أن تكون بسيطة وواضحة.' },
                example: { type: Type.STRING, description: 'مثال رقمي يوضح كيفية تطبيق الصيغة على بيانات شهرية. استخدم أرقامًا واقعية ومنطقية.' },
                tip: { type: Type.STRING, description: 'نصيحة قصيرة ومفيدة لتحسين الدقة أو فهم المؤشر بشكل أفضل باللغة العربية.' },
                inputFields: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "معرف فريد لحقل الإدخال باللغة الإنجليزية (snake_case)، مثال: 'total_turnaround_minutes'." },
                            label: { type: Type.STRING, description: "تسمية حقل الإدخال باللغة العربية، مثال: 'إجمالي دقائق خدمة الطائرة'." }
                        },
                        required: ["id", "label"]
                    }
                },
                formula: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, enum: ['division_percent', 'rate_per_1000', 'simple_value', 'average'], description: "اسم الصيغة المستخدمة." },
                        input_ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "قائمة بمعرفات حقول الإدخال المستخدمة في الصيغة بالترتيب. للمقسومات، الأول هو البسط والثاني هو المقام." }
                    },
                    required: ["name", "input_ids"]
                }
            },
            required: ["title", "objective", "required_data", "steps", "example", "tip", "inputFields", "formula"]
        };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت خبير استشاري في عمليات المناولة الأرضية للطيران. مهمتك هي تقديم دليل واضح ومفصل، خطوة بخطوة، لمدير حول كيفية حساب مؤشر أداء رئيسي (KPI) معين. يجب أن يكون الدليل عمليًا وسهل المتابعة وموجهًا لمدير يحتاج إلى جمع البيانات وإجراء الحساب على أساس شهري. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };

    return withLockAndCache(cacheKey, apiCall);
};

export const generateActionPlanSteps = async (recommendationText: string): Promise<{ steps: { text: string, days_to_complete: number }[] }> => {
    const cacheKey = `action_plan_${recommendationText.slice(0, 50)}`;
    const apiCall = async () => {
        const prompt = `
            بناءً على التوصية التالية: "${recommendationText}", قم بإنشاء خطة عمل مفصلة.
            
            المطلوب:
            - قدم 3 إلى 5 خطوات عملية ومحددة وقابلة للتنفيذ.
            - لكل خطوة، قدر عدد الأيام اللازمة لإكمالها (days_to_complete).
            - يجب أن تكون الخطوات باللغة العربية.
        `;
        
        const schema = {
            type: Type.OBJECT,
            properties: {
                steps: {
                    type: Type.ARRAY,
                    description: "قائمة بخطوات العمل.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING, description: "نص خطوة العمل." },
                            days_to_complete: { type: Type.INTEGER, description: "عدد الأيام المتوقع لإكمال الخطوة." }
                        },
                        required: ["text", "days_to_complete"]
                    }
                }
            },
            required: ["steps"]
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت مدير مشاريع خبير متخصص في عمليات الطيران. مهمتك هي تحويل التوصيات إلى خطط عمل قابلة للتنفيذ. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};

export const generateKpiTargetSuggestion = async (kpi: KPI): Promise<{ suggested_target: number, reasoning: string }> => {
    const cacheKey = `target_suggestion_${kpi.id}`;
    const apiCall = async () => {
        const prompt = `
            أنت خبير في تحديد الأهداف (Target Setting) لشركات المناولة الأرضية.
            مؤشر الأداء الرئيسي: "${kpi.name}"
            - الوصف: ${kpi.tooltip.description}
            - الهدف الحالي: ${kpi.target}
            - القيمة الأقل هي الأفضل؟: ${kpi.lowerIsBetter}
            - القيم التاريخية (آخر 6 شهور): ${kpi.history.slice(-6).map(h => h.value).join(', ')}
            - المرجع النموذجي (Benchmark) إن وجد: ${kpi.benchmark ? `${kpi.benchmark.target} (المصدر: ${kpi.benchmark.source})` : 'لا يوجد'}

            المطلوب:
            1. اقترح قيمة هدف (suggested_target) جديدة وطموحة ولكنها واقعية لهذا المؤشر.
            2. قدم تبريرًا (reasoning) واضحًا وموجزًا باللغة العربية لاقتراحك، مع الأخذ في الاعتبار الأداء التاريخي والهدف الحالي والمرجع النموذجي.
        `;
        
        const schema = {
            type: Type.OBJECT,
            properties: {
                suggested_target: { type: Type.NUMBER, description: "قيمة الهدف المقترحة." },
                reasoning: { type: Type.STRING, description: "التبرير المنطقي للهدف المقترح." }
            },
            required: ["suggested_target", "reasoning"]
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت خبير في تحديد أهداف الأداء. قم بتحليل بيانات المؤشر واقترح هدفًا جديدًا مع تبرير. قم بالرد بتنسيق JSON حصريًا.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};

export const generateExecutiveForecastAnalysis = (managers: Manager[], timePeriod: TimePeriod): Promise<AnalysisResult> => {
    const cacheKey = `exec_forecast_analysis_${timePeriod}`;
    const apiCall = async () => {
        const { stationHistory, forecastedScore } = forecastStationScore(managers);
        if (forecastedScore === null || stationHistory.length === 0) {
            throw new Error("لا توجد بيانات كافية للتنبؤ.");
        }
        
        const performanceSummary = `
            ملخص أداء المحطة التاريخي والمتوقع:
            - الأداء التاريخي (آخر 6 فترات): ${stationHistory.slice(-6).map(h => `${h.value}%`).join(', ')}
            - النتيجة الإجمالية المتوقعة للفترة القادمة: ${forecastedScore}%
        `;

        const prompt = `
            بصفتك محللًا استراتيجيًا، قم بتحليل بيانات الأداء التاريخية والتوقعات المستقبلية التالية لمحطة مناولة أرضية كاملة.
            ${performanceSummary}

            المطلوب:
            1.  قدم تحليلاً للتوقعات المستقبلية، موضحًا ما إذا كان الأداء في تحسن أم تراجع، وما هي الآثار المترتبة على ذلك.
            2.  اقترح 3 توصيات استباقية (proactive) للاستفادة من الاتجاهات الإيجابية أو لمواجهة التحديات المتوقعة. لكل توصية، حدد القسم (الدور الوظيفي) الأكثر صلة. الأدوار المتاحة هي: ['RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'].
            يجب أن يكون الرد باللغة العربية، وبتنسيق JSON حصريًا.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت خبير استراتيجي في عمليات الطيران متخصص في التحليل التنبؤي. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: analysisSchema, // Reusing the same schema as other analyses
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };

    return withLockAndCache(cacheKey, apiCall);
};

export const generatePillarDiagnosis = (
    pillarName: string,
    pillarScore: number,
    managersData: { managerName: string; kpiPerformances: { kpiName: string; score: number }[] }[]
): Promise<PillarDiagnosisResult> => {
    const cacheKey = `pillar_diagnosis_${pillarName}`;
    const apiCall = async () => {
        const prompt = `
            أنت خبير في تشخيص الأداء التشغيلي. قم بتحليل أداء الركيزة التالية:
            - اسم الركيزة: ${pillarName}
            - متوسط الأداء الإجمالي للركيزة: ${pillarScore}%

            - بيانات أداء المدراء لهذه الركيزة:
            ${managersData.map(m => `
                - المدير: ${m.managerName}
                  - أداء مؤشراته: ${m.kpiPerformances.map(k => `${k.kpiName} (${k.score}%)`).join(', ')}
            `).join('')}

            المطلوب:
            1.  **analysis**: قدم تحليلاً موجزاً يوضح سبب أداء هذه الركيزة (جيد أو سيء)، مع الإشارة إلى الاتجاهات العامة.
            2.  **contributing_managers**: حدد 1-3 مدراء هم الأكثر تأثيراً (إيجاباً أو سلباً) على أداء هذه الركيزة، مع ذكر سبب اختيار كل منهم (reasoning) بشكل موجز.
            3.  **recommendations**: قدم 2-3 توصيات عامة وموجهة لتحسين أداء هذه الركيزة على مستوى المحطة ككل. حدد القسم المستهدف (targetRole) لكل توصية.
        `;

        const schema = {
            type: Type.OBJECT,
            properties: {
                analysis: { type: Type.STRING },
                contributing_managers: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            manager_name: { type: Type.STRING },
                            reasoning: { type: Type.STRING },
                        },
                        required: ["manager_name", "reasoning"],
                    },
                },
                recommendations: analysisSchema.properties.recommendations, // Reuse from other schema
            },
            required: ["analysis", "contributing_managers", "recommendations"],
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت محلل أداء خبير. مهمتك هي تشخيص أداء ركيزة معينة وتحديد المدراء المؤثرين وتقديم توصيات. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};


export const generateBulkRiskProfiles = async (managers: Manager[], timePeriod: TimePeriod): Promise<Record<string, RiskProfile>> => {
    const cacheKey = `bulk_risk_profiles_${timePeriod}`;
    const apiCall = async (): Promise<Record<string, RiskProfile>> => {
        const managersData = managers.map(manager => {
            const riskKpis = manager.pillars
                .flatMap(p => p.kpis)
                .filter(kpi => KPI_CATEGORIES['السلامة والجودة والأمن'].includes(kpi.id));

            return {
                id: manager.id,
                name: manager.name,
                risk_kpis: riskKpis.map(kpi => ({
                    name: kpi.name,
                    value: kpi.value,
                    target: kpi.target,
                    lowerIsBetter: kpi.lowerIsBetter,
                    score: calculateKpiScore(kpi),
                })),
            };
        });

        const prompt = `
            أنت خبير في إدارة مخاطر السلامة والجودة في قطاع الطيران (Aviation Safety & Quality).
            مهمتك هي تقييم ملف المخاطر لكل مدير بناءً على أدائه في مؤشرات السلامة والجودة والأمن فقط.
            
            فيما يلي بيانات أداء المدراء في مؤشرات المخاطر:
            ${JSON.stringify(managersData, null, 2)}

            المطلوب:
            أنشئ مصفوفة من ملفات المخاطر للمدراء. لكل مدير:
            1.  **profile**: اكتب وصفًا موجزًا (جملة واحدة) لملف المخاطر الخاص به. مثال: "ملف مخاطر منخفض مع التزام قوي بمعايير السلامة."
            2.  **reasoning**: قدم تبريرًا مختصرًا يعتمد على بيانات مؤشرات المخاطر المحددة.
            3.  **risk_level**: صنف مستوى المخاطر إلى واحد من ثلاثة: 'Low', 'Medium', 'High'.
                - 'High': إذا كان هناك أداء ضعيف جداً في مؤشر حرج (مثل الأضرار الأرضية) أو أداء ضعيف في عدة مؤشرات سلامة.
                - 'Low': إذا كان الأداء ممتازًا في جميع مؤشرات المخاطر تقريبًا.
                - 'Medium': للحالات المتوسطة.
        `;

        const schema = {
            type: Type.OBJECT,
            properties: {
                profiles: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            manager_id: { type: Type.STRING },
                            profile_data: {
                                type: Type.OBJECT,
                                properties: {
                                    profile: { type: Type.STRING },
                                    reasoning: { type: Type.STRING },
                                    risk_level: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
                                },
                                required: ['profile', 'reasoning', 'risk_level']
                            }
                        },
                        required: ['manager_id', 'profile_data']
                    }
                }
            },
            required: ['profiles']
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت خبير في إدارة مخاطر السلامة الجوية. قم بتحليل بيانات المدراء وقدم ملف مخاطر لكل منهم. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        const jsonText = response.text.trim();
        const result = JSON.parse(jsonText);
        
        const profilesMap: Record<string, RiskProfile> = {};
        result.profiles.forEach(item => {
            profilesMap[item.manager_id] = item.profile_data;
        });
        return profilesMap;
    };
    
    return withLockAndCache(cacheKey, apiCall);
};

export const generateTrendAnalysis = async (kpi: KPI, managerId: string): Promise<{ analysis: string, suggestion: string }> => {
    const cacheKey = `trend_analysis_${kpi.id}_${managerId}`;
    const apiCall = async () => {
        const prompt = `
            حلل الاتجاه التاريخي لمؤشر الأداء التالي:
            - اسم المؤشر: ${kpi.name}
            - الهدف: ${kpi.target}
            - القيمة الأقل أفضل؟: ${kpi.lowerIsBetter}
            - القيم التاريخية (آخر 6 شهور): ${kpi.history.slice(-6).map(h => h.value).join(', ')}

            المطلوب:
            1.  **analysis**: اكتب تحليلاً موجزاً للاتجاه، هل هو في تحسن، استقرار، أم تدهور؟
            2.  **suggestion**: قدم اقتراحاً واحداً ومحدداً يمكن للمدير اتخاذه بناءً على هذا الاتجاه.
        `;
        const schema = {
            type: Type.OBJECT,
            properties: {
                analysis: { type: Type.STRING },
                suggestion: { type: Type.STRING }
            },
            required: ["analysis", "suggestion"]
        };
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت محلل بيانات متخصص في تفسير الاتجاهات الزمنية. كن موجزاً ومباشراً. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};

export const generateForecastAnalysis = async (kpi: KPI, managerId: string, forecastedValue: number): Promise<AnalysisResult> => {
    const cacheKey = `forecast_analysis_${kpi.id}_${managerId}`;
    const apiCall = async () => {
        const prompt = `
            بناءً على التنبؤ التالي لمؤشر الأداء، قدم تحليلاً وتوصيات.
            - اسم المؤشر: ${kpi.name}
            - الهدف: ${kpi.target}
            - القيمة الحالية: ${kpi.value}
            - القيمة المتوقعة: ${forecastedValue}
            - القيمة الأقل أفضل؟: ${kpi.lowerIsBetter}

            المطلوب:
            1.  **analysis**: اكتب تحليلاً موجزاً للتنبؤ. هل هو إيجابي أم سلبي؟ وماذا يعني للمدير؟
            2.  **recommendations**: قدم قائمة من 2-3 توصيات (أفضل الممارسات) لمساعدة المدير على تحسين هذا المؤشر أو الحفاظ على أدائه الجيد.
        `;
        const schema = {
             type: Type.OBJECT,
            properties: {
                analysis: { type: Type.STRING },
                recommendations: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text: { type: Type.STRING },
                            targetRole: { type: Type.STRING, enum: ['RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'] }
                        },
                         required: ["text", "targetRole"],
                    }
                }
            },
            required: ["analysis", "recommendations"]
        };
         const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت مستشار أداء خبير. قم بتحليل التنبؤ وقدم نصائح عملية. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};

export const generateCompetitionAnnouncement = async (winnerName: string, score: number, month: string): Promise<{ announcement: string }> => {
    const cacheKey = `announcement_${winnerName}_${month}`;
    const apiCall = async () => {
        const prompt = `
            اكتب مسودة إعلان احتفالية ومحفزة باللغة العربية للإعلان عن فوز المدير "${winnerName}" بلقب "مدير الشهر" لشهر ${month}، حيث حقق نتيجة أداء مذهلة بلغت ${score}%.
            - يجب أن يكون الإعلان مهنئاً ومحفزاً لبقية الفريق.
            - اجعله قصيراً ومناسباً للنشر على لوحة الإعلانات الداخلية للشركة.
        `;
        const schema = {
            type: Type.OBJECT,
            properties: {
                announcement: { type: Type.STRING }
            },
            required: ["announcement"]
        };
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت خبير في الاتصالات الداخلية والموارد البشرية. مهمتك هي كتابة إعلانات إيجابية ومحفزة. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};

export const generateWinnerAnalysis = async (winner: Manager, score: number, month: string): Promise<{ analysis: string }> => {
    const cacheKey = `winner_analysis_${winner.id}_${month}`;
    const apiCall = async () => {
        const topKpis = winner.pillars.flatMap(p => p.kpis)
            .map(k => ({ name: k.name, score: calculateKpiScore(k) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
        
        const prompt = `
            المدير "${winner.name}" فاز بلقب مدير الشهر لـ ${month} بنتيجة ${score}%.
            أبرز نقاط القوة في أدائه كانت في المؤشرات التالية:
            ${topKpis.map(k => `- ${k.name} (أداء ${k.score}%)`).join('\n')}

            المطلوب:
            اكتب تحليلاً موجزاً (2-3 جمل) باللغة العربية يشرح سر الأداء المتميز للفائز، مع التركيز على نقاط القوة المذكورة.
        `;
        const schema = {
            type: Type.OBJECT,
            properties: {
                analysis: { type: Type.STRING }
            },
            required: ["analysis"]
        };
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت محلل أداء. مهمتك هي تفسير سبب الأداء العالي لشخص ما بطريقة موجزة وواضحة. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};

export const generateRootCauseAnalysis = async (kpi: KPI, manager: Manager): Promise<RootCauseAnalysis> => {
    const cacheKey = `rca_${kpi.id}_${manager.id}`;
    const apiCall = async () => {
        const prompt = `
            مؤشر الأداء الرئيسي "${kpi.name}" يظهر أداءً ضعيفًا للمدير ${manager.name}.
            - القيمة الحالية: ${kpi.value}, الهدف: ${kpi.target} (القيمة الأقل أفضل؟ ${kpi.lowerIsBetter})
            - دور المدير: ${manager.role}

            باستخدام معرفتك بعمليات المناولة الأرضية، قم بإجراء تحليل السبب الجذري (Root Cause Analysis).
            صنّف الأسباب المحتملة ضمن الفئات التالية: 'الأفراد', 'العمليات', 'المعدات', 'العوامل الخارجية'.
            لكل فئة، قدم 2-3 أسباب محتملة ومحددة قد تكون أدت إلى هذا الأداء الضعيف.
        `;
        const schema = {
            type: Type.OBJECT,
            properties: {
                causes: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING, enum: ['الأفراد', 'العمليات', 'المعدات', 'العوامل الخارجية'] },
                            reasons: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["category", "reasons"]
                    }
                }
            },
            required: ["causes"]
        };
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت خبير في تحليل السبب الجذري لعمليات الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};


export const generateWhatIfAnalysis = async (kpi: KPI, newValue: number, stationScore: number): Promise<WhatIfAnalysis> => {
    const cacheKey = `whatif_${kpi.id}_${newValue}`;
    const apiCall = async () => {
        const prompt = `
            أنت محلل استراتيجي متخصص في محاكاة "ماذا لو" (What-If Analysis).
            - المؤشر المستهدف للتغيير: ${kpi.name}
            - القيمة الافتراضية الجديدة: ${newValue} (الهدف الحالي: ${kpi.target})
            - الأداء العام الحالي للمحطة: ${stationScore}%

            بناءً على هذا التغيير الافتراضي في المؤشر، قم بإنشاء تحليل شامل:
            1.  **simulation_summary**: اكتب ملخصاً موجزاً (2-3 جمل) يصف السيناريو المقترح وتأثيره العام المحتمل.
            2.  **overall_score_impact**: قدر التأثير على الأداء العام للمحطة. يجب أن تكون قيمة "to" أعلى من "from".
            3.  **related_kpis_impact**: صف التأثيرات المتسلسلة (cascading effects) على 2-3 مؤشرات أخرى ذات صلة. لكل مؤشر، صف التأثير المتوقع (impact_description).
            4.  **recommendations**: قدم 2-3 توصيات استراتيجية لتحقيق هذا التحسين المقترح.
        `;
        const schema = {
            type: Type.OBJECT,
            properties: {
                simulation_summary: { type: Type.STRING },
                overall_score_impact: {
                    type: Type.OBJECT,
                    properties: {
                        from: { type: Type.NUMBER },
                        to: { type: Type.NUMBER }
                    },
                    required: ["from", "to"]
                },
                related_kpis_impact: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            kpi_name: { type: Type.STRING },
                            impact_description: { type: Type.STRING }
                        },
                        required: ["kpi_name", "impact_description"]
                    }
                },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["simulation_summary", "overall_score_impact", "related_kpis_impact", "recommendations"]
        };
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت محلل استراتيجي خبير. قم بإجراء تحليل 'ماذا لو' بناءً على المدخلات. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};

export const askConversational = async (question: string, context: any): Promise<string> => {
    const prompt = `
        أنت مساعد ذكاء اصطناعي متخصص في تحليل بيانات أداء المناولة الأرضية.
        السياق الحالي للتطبيق (JSON):
        ${JSON.stringify(context, null, 2)}

        سؤال المستخدم: "${question}"

        أجب على سؤال المستخدم باللغة العربية بناءً على السياق المقدم. كن موجزاً ومفيداً. استخدم تنسيق Markdown إذا لزم الأمر.
    `;
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: 'أنت مساعد ذكاء اصطناعي متخصص في تحليل بيانات أداء المناولة الأرضية.',
        },
    });
    return response.text;
};

export const generateSmartSummary = async (stationScore: number, pillars: { name: string, score: number }[], timePeriod: TimePeriod): Promise<{ summary: string }> => {
    const cacheKey = `smart_summary_${timePeriod}`;
    const apiCall = async () => {
        const topPillar = pillars.reduce((max, p) => p.score > max.score ? p : max, pillars[0]);
        const bottomPillar = pillars.reduce((min, p) => p.score < min.score ? p : min, pillars[0]);

        const prompt = `
            بناءً على بيانات الأداء التالية للمحطة، اكتب ملخصًا ذكيًا وموجزًا (جملة واحدة أو جملتين).
            - الأداء العام للمحطة: ${stationScore}%
            - أفضل ركيزة أداءً: ${topPillar.name} (${topPillar.score}%)
            - أضعف ركيزة أداءً: ${bottomPillar.name} (${bottomPillar.score}%)
            - الفترة الزمنية: ${timePeriod === 'monthly' ? 'شهري' : timePeriod === 'quarterly' ? 'ربع سنوي' : 'سنوي'}
        `;
        const schema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING }
            },
            required: ["summary"]
        };
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت محلل بيانات. مهمتك هي كتابة ملخصات موجزة وذكية. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};


export const generateMeetingSummary = async (manager: Manager, timePeriod: TimePeriod): Promise<{ summary: string }> => {
    const cacheKey = `meeting_summary_${manager.id}_${timePeriod}`;
    const apiCall = async () => {
        const overallScore = calculateManagerOverallScore(manager.pillars);
        const topPillar = manager.pillars.reduce((max, p) => calculatePillarScore(p) > calculatePillarScore(max) ? p : max);
        const bottomPillar = manager.pillars.reduce((min, p) => calculatePillarScore(p) < calculatePillarScore(min) ? p : min);
        const openActionPlans = manager.actionPlans.filter(p => p.steps.some(s => !s.isCompleted));

        const prompt = `
            أنت مساعد إداري تنفيذي. قم بإعداد ملخص موجز ومحترف لمراجعة الأداء للمدير ${manager.name}.
            
            بيانات الأداء:
            - الأداء العام: ${overallScore}%
            - أفضل ركيزة: ${topPillar.name} (بنتيجة ${calculatePillarScore(topPillar)}%)
            - أضعف ركيزة: ${bottomPillar.name} (بنتيجة ${calculatePillarScore(bottomPillar)}%)
            - عدد خطط العمل المفتوحة: ${openActionPlans.length}
            
            المطلوب:
            اكتب ملخصًا من 3-4 نقاط رئيسية. يجب أن يتضمن:
            1.  تقييمًا عامًا للأداء.
            2.  إشارة إلى أبرز نقاط القوة (أفضل ركيزة).
            3.  إشارة إلى أهم مجالات التحسين (أضعف ركيزة).
            4.  دعوة لمناقشة خطط العمل المفتوحة.
            
            استخدم تنسيق Markdown (نقاط نقطية).
        `;

        const schema = {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING, description: "ملخص بتنسيق Markdown." }
            },
            required: ["summary"]
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: "أنت مساعد إداري تنفيذي، متخصص في إعداد ملخصات اجتماعات الأداء. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };
    return withLockAndCache(cacheKey, apiCall);
};

export const generateProcedureRiskAssessment = async (procedureText: string, fileData: string, mimeType: string): Promise<ProcedureRiskAssessment> => {
    const cacheKey = `proc_risk_${procedureText.slice(0, 50)}`;
    const apiCall = async () => {
        const filePart = {
            inlineData: {
                data: fileData,
                mimeType: mimeType,
            },
        };
        const textPart = {
            text: `
                أنت خبير في تقييم مخاطر السلامة والجودة في الطيران (Aviation Safety & Quality Risk Assessor) ومراجع معتمد لمعايير ISAGO.
                
                **المهمة:**
                قم بتحليل الإجراء التشغيلي الموصوف أدناه، وقارنه بالدليل الرسمي المرفق، ثم قدم تقييمًا شاملاً للمخاطر.
                
                **الإجراء الموصوف (كما يتم تنفيذه حاليًا):**
                ---
                ${procedureText}
                ---
                
                **الدليل المرجعي الرسمي مرفق كملف.**
                
                **المطلوب:**
                قم بإرجاع تحليل مفصل بتنسيق JSON باللغة العربية، بناءً على النموذج المحدد.
            `
        };

        const schema = {
            type: Type.OBJECT,
            properties: {
                procedure_summary: { type: Type.STRING, description: "ملخص موجز للإجراء الذي تم وصفه." },
                compliance_analysis: {
                    type: Type.OBJECT,
                    properties: {
                        overall_compliance_level: { type: Type.STRING, enum: ['متوافق', 'انحرافات طفيفة', 'انحرافات كبيرة', 'غير متوافق'] },
                        summary: { type: Type.STRING, description: "ملخص لتحليل الامتثال." },
                        discrepancies: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    described_practice: { type: Type.STRING, description: "الممارسة الفعلية التي تنحرف عن الدليل." },
                                    manual_guideline: { type: Type.STRING, description: "ما يقوله الدليل الرسمي بشأن هذه الممارسة." },
                                    risk_implication: { type: Type.STRING, description: "شرح للمخاطر المترتبة على هذا الانحراف." }
                                },
                                required: ["described_practice", "manual_guideline", "risk_implication"]
                            }
                        }
                    },
                    required: ["overall_compliance_level", "summary", "discrepancies"]
                },
                identified_risks: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            risk_title: { type: Type.STRING },
                            risk_description: { type: Type.STRING },
                            category: { type: Type.STRING, enum: ['السلامة', 'التشغيل', 'الأمن', 'العوامل البشرية', 'الامتثال'] },
                            likelihood: { type: Type.STRING, enum: ['نادر', 'غير محتمل', 'محتمل', 'مرجح', 'شبه مؤكد'] },
                            impact: { type: Type.STRING, enum: ['ضئيل', 'طفيف', 'متوسط', 'كبير', 'كارثي'] }
                        },
                        required: ["risk_title", "risk_description", "category", "likelihood", "impact"]
                    }
                },
                mitigation_steps: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            step_title: { type: Type.STRING },
                            step_description: { type: Type.STRING },
                            responsible_department: { type: Type.STRING, enum: ['RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'] }
                        },
                        required: ["step_title", "step_description", "responsible_department"]
                    }
                },
                overall_assessment: { type: Type.STRING, description: "تقييم ختامي شامل للمخاطر المرتبطة بهذا الإجراء." }
            },
            required: ["procedure_summary", "compliance_analysis", "identified_risks", "mitigation_steps", "overall_assessment"]
        };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [textPart, filePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });
        
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    };

    return withLockAndCache(cacheKey, apiCall);
};