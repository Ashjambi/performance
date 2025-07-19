import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import type { Pillar, KPI, AnalysisResult, CalculationGuide, KPIHistory, Manager, ManagerRole, Recommendation, WhatIfAnalysis, RiskProfile, TimePeriod, ProcedureRiskAssessment, StandardProcedureAssessment, TrainingScenario, RegisteredRisk, GeneratedChecklist, StrategicGoal, GeneratedChecklistItem } from '../data.tsx';
import { calculateKpiScore, calculatePillarScore, calculateManagerOverallScore, KPI_CATEGORIES, forecastStationScore, ALL_KPIS } from '../data.tsx';
import { toast } from 'react-hot-toast';

// --- Caching Service ---
const CACHE_PREFIX = 'gemini_cache_';

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
// --- End Caching Service ---

// --- AI Initialization and Guard ---
declare var process: { env: { [key: string]: string | undefined } };
const apiKey = process.env.API_KEY;
let ai: GoogleGenAI | null = null;
export const API_KEY_ERROR_MESSAGE = "ميزات الذكاء الاصطناعي معطلة. لم يتم تكوين مفتاح الواجهة البرمجية (API Key).";


if (apiKey) {
  try {
    ai = new GoogleGenAI({ apiKey });
  } catch (e) {
    console.error("Failed to initialize GoogleGenAI", e);
    ai = null;
  }
} else {
  console.warn("Gemini API key is not configured. AI features will be disabled.");
}

export const isAiAvailable = !!ai;

const getAI = (): GoogleGenAI => {
    if (!ai) {
        throw new Error(API_KEY_ERROR_MESSAGE);
    }
    return ai;
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

export type PillarDiagnosisResult = {
  analysis: string;
  contributing_managers: {
    manager_name: string;
    reasoning: string;
  }[];
  recommendations: Recommendation[];
};


export const generatePerformanceAnalysis = async (manager: Manager, timePeriod: TimePeriod): Promise<AnalysisResult> => {
    const ai = getAI();
    const cacheKey = `analysis_${manager.id}_${timePeriod}`;
    const cachedData = getFromCache<AnalysisResult>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع التحليل من الذاكرة المؤقتة.");
        return cachedData;
    }
    
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
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};

export const generateExecutiveAnalysis = async (
    managersForDisplay: Manager[],
    timePeriod: TimePeriod
): Promise<AnalysisResult> => {
    const ai = getAI();
    const cacheKey = `exec_analysis_${timePeriod}`;
    const cachedData = getFromCache<AnalysisResult>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع التحليل الاستراتيجي من الذاكرة المؤقتة.");
        return cachedData;
    }
    
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
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};


export const generateCalculationGuide = async (kpi: KPI): Promise<CalculationGuide> => {
    const ai = getAI();
    const cacheKey = `guide_${kpi.id}`;
    const cachedData = getFromCache<CalculationGuide>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع دليل الحساب من الذاكرة المؤقتة.");
        return cachedData;
    }

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
            title: { type: Type.STRING },
            objective: { type: Type.STRING },
            required_data: { type: Type.ARRAY, items: { type: Type.STRING }},
            steps: { type: Type.ARRAY, items: { type: Type.STRING }},
            example: { type: Type.STRING },
            tip: { type: Type.STRING },
            inputFields: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING, description: "معرف فريد باللغة الإنجليزية للمدخلات" },
                        label: { type: Type.STRING, description: "تسمية واضحة باللغة العربية" }
                    },
                    required: ["id", "label"]
                }
            },
            formula: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "اسم الصيغة: 'division_percent', 'rate_per_1000', 'average', or 'simple_value'." },
                    input_ids: { type: Type.ARRAY, items: { type: Type.STRING }}
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
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت خبير استشاري متخصص في عمليات المناولة الأرضية. قم بالرد بتنسيق JSON حصريًا باللغة العربية.",
        }
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};

export const generateActionPlanSteps = async (recommendation: string): Promise<{ steps: { text: string, days_to_complete: number }[] }> => {
    const ai = getAI();
    const cacheKey = `plan_steps_${recommendation.substring(0, 100)}`;
    const cachedData = getFromCache<{ steps: { text: string, days_to_complete: number }[] }>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع خطوات خطة العمل من الذاكرة المؤقتة.");
        return cachedData;
    }

    const prompt = `
        أنت قائد خبير ومدرب في مجال عمليات المناولة الأرضية. مهمتك هي تحويل التوصيات الاستراتيجية إلى خطط عمل قابلة للتنفيذ.

        التوصية هي: "${recommendation}"

        المطلوب:
        قم بتفصيل هذه التوصية إلى 3-4 خطوات عملية، محددة، وقابلة للقياس يمكن لمدير تنفيذها.
        لكل خطوة، اقترح عدد الأيام المقدرة لإنجازها.

        الرد يجب أن يكون بتنسيق JSON حصريًا، يحتوي على قائمة من الكائنات باللغة العربية.
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            steps: {
                type: Type.ARRAY,
                description: "قائمة من 3-4 خطوات عملية باللغة العربية.",
                items: { 
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING, description: "نص الخطوة القابلة للتنفيذ." },
                        days_to_complete: { type: Type.NUMBER, description: "عدد الأيام المقدرة لإنجاز الخطوة." }
                    },
                     required: ["text", "days_to_complete"]
                }
            }
        },
        required: ["steps"]
    };
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت خبير استراتيجي في عمليات الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};

export const generateTrendAnalysis = async (
    kpi: KPI, 
    managerId: string
): Promise<{analysis: string; suggestion: string}> => {
    const ai = getAI();
    const cacheKey = `trend_analysis_${managerId}_${kpi.id}`;
    const cachedData = getFromCache<{analysis: string; suggestion: string}>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع تحليل الاتجاه من الذاكرة المؤقتة.");
        return cachedData;
    }

    const history = (kpi?.history || []).slice(-6);

    const prompt = `
    أنت محلل بيانات خبير في قطاع الطيران. قم بتحليل الأداء التاريخي لمؤشر الأداء الرئيسي التالي:
    - اسم المؤشر: "${kpi.name}"
    - القيمة الحالية: ${kpi.value.toFixed(2)}
    - الهدف: ${kpi.target}
    - هل القيمة الأقل أفضل؟: ${kpi.lowerIsBetter ? 'نعم' : 'لا'}

    البيانات التاريخية (آخر 6 أشهر، من الأقدم إلى الأحدث):
    ${history.map(h => `- في شهر ${new Date(h.date).toLocaleString('ar-EG', { month: 'long' })}: ${h.value.toFixed(2)}`).join('\n')}

    المطلوب:
    1.  **analysis**: قدم تحليلاً موجزاً للاتجاه العام للأداء (مثال: تحسن مستمر، تدهور ملحوظ، استقرار مع تقلبات بسيطة).
    2.  **suggestion**: قدم نصيحة واحدة قصيرة وعملية بناءً على هذا الاتجاه.

    يجب أن يكون الرد بتنسيق JSON حصريًا وباللغة العربية.
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            analysis: { type: Type.STRING, description: "تحليل موجز للاتجاه العام للأداء باللغة العربية." },
            suggestion: { type: Type.STRING, description: "نصيحة قصيرة وعملية بناءً على الاتجاه باللغة العربية." }
        },
        required: ["analysis", "suggestion"]
    };

     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت محلل بيانات خبير في قطاع الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};

export const generateForecastAnalysis = async (
    kpi: KPI,
    managerId: string,
    forecastedValue: number
): Promise<AnalysisResult> => {
    const ai = getAI();
    const cacheKey = `forecast_analysis_${managerId}_${kpi.id}`;
    const cachedData = getFromCache<AnalysisResult>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع تحليل التوقعات من الذاكرة المؤقتة.");
        return cachedData;
    }

    const prompt = `
        أنت مستشار أداء استباقي وخبير في عمليات الطيران. مهمتك هي تحليل التنبؤ المستقبلي لمؤشر أداء وتقديم إرشادات عملية.

        بيانات المؤشر:
        - اسم المؤشر: "${kpi.name}"
        - القيمة الحالية: ${kpi.value.toFixed(2)}
        - الهدف: ${kpi.target}
        - هل القيمة الأقل أفضل؟: ${kpi.lowerIsBetter ? 'نعم' : 'لا'}
        - القيمة المتوقعة للشهر القادم: ${forecastedValue.toFixed(2)}

        البيانات التاريخية (آخر 6 أشهر، من الأقدم إلى الأحدث):
        ${(kpi.history || []).map(h => `- ${new Date(h.date).toLocaleString('ar-EG', { month: 'long' })}: ${h.value.toFixed(2)}`).join('\n')}

        المطلوب:
        1.  **analysis**: قدم تحليلاً موجزاً يشرح معنى هذا التنبؤ. هل المسار إيجابي أم سلبي؟ هل سيحقق الهدف أم يبتعد عنه؟ ما هي الآثار المترتبة على هذا المسار المستقبلي؟
        2.  **recommendations**: قدم قائمة من 2-3 من أفضل الممارسات العملية والقابلة للتنفيذ التي يمكن للمدير تطبيقها لتصحيح المسار إذا كان سلبيًا، أو لتعزيزه إذا كان إيجابيًا. يجب أن ترتبط كل توصية بالقسم الأكثر صلة بتنفيذها.
    `;
    
     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema, // Re-using the same schema
            systemInstruction: "أنت مستشار أداء استباقي وخبير في عمليات الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};


export const generateExecutiveForecastAnalysis = async (
    managers: Manager[], 
    timePeriod: TimePeriod
): Promise<AnalysisResult> => {
    const ai = getAI();
    const cacheKey = `exec_forecast_${timePeriod}`;
    const cachedData = getFromCache<AnalysisResult>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع توقعات المحطة من الذاكرة المؤقتة.");
        return cachedData;
    }
    
    const { stationHistory, forecastedScore } = forecastStationScore(managers);
    
    if (forecastedScore === null) {
        throw new Error("لا توجد بيانات كافية للتنبؤ.");
    }
    const currentScore = stationHistory.length > 0 ? stationHistory[stationHistory.length - 1].value : 0;
    
    const prompt = `
        بصفتك كبير المستشارين الاستراتيجيين للرئيس التنفيذي للعمليات (COO)، قم بتحليل التوقعات المستقبلية لأداء المحطة.

        بيانات أداء المحطة:
        - الأداء الحالي الإجمالي للمحطة: ${currentScore}%
        - الأداء المتوقع للربع القادم: ${forecastedScore}%

        الأداء التاريخي الإجمالي للمحطة (آخر 6 أشهر):
        ${stationHistory.map(h => `- ${new Date(h.date).toLocaleString('ar-EG', { month: 'long' })}: ${h.value}%`).join('\n')}

        المطلوب:
        1.  **analysis**: قدم تحليلاً استراتيجياً لما يعنيه هذا التوقع. هل المحطة على المسار الصحيح لتحقيق أهدافها الاستراتيجية؟ ما هي الفرص أو المخاطر التي يكشفها هذا التنبؤ؟
        2.  **recommendations**: اقترح 2-3 توصيات استراتيجية رفيعة المستوى. يمكن أن تشمل هذه التوصيات مبادرات على مستوى المحطة، أو مجالات تتطلب استثمارًا، أو تغييرات في السياسات، أو تركيزًا على أدوار وظيفية معينة. لكل توصية، حدد القسم المسؤول عن قيادتها.

        يجب أن يكون الرد بتنسيق JSON حصريًا باللغة العربية.
    `;
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema, // Re-using the same schema
            systemInstruction: "أنت مستشار استراتيجي كبير للقيادة التنفيذية في قطاع الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};

export const generateKpiTargetSuggestion = async (kpi: KPI): Promise<{ suggested_target: number; reasoning: string }> => {
    const ai = getAI();
    const cacheKey = `target_suggestion_${kpi.id}`;
    const cachedData = getFromCache<{ suggested_target: number; reasoning: string }>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع اقتراح الهدف من الذاكرة المؤقتة.");
        return cachedData;
    }

    const historySlice = kpi.history.slice(-6);
    const historicalAverage = historySlice.length > 0 ? historySlice.reduce((sum, h) => sum + h.value, 0) / historySlice.length : kpi.value;

    const prompt = `
        أنت خبير استراتيجي في تحديد أهداف مؤشرات الأداء (KPIs) لشركات الطيران.
        مهمتك هي تحليل البيانات التالية واقتراح هدف جديد.

        **البيانات:**
        - **اسم المؤشر:** "${kpi.name}"
        - **القيمة الحالية:** ${kpi.value}
        - **متوسط الأداء التاريخي (آخر 6 قيم):** ${historicalAverage.toFixed(2)}
        - **هل الأقل أفضل؟:** ${kpi.lowerIsBetter ? 'نعم' : 'لا'}
        - **الأداء التاريخي (آخر 6 قيم):** ${historySlice.map(h => h.value.toFixed(2)).join(', ')}

        **التعليمات الصارمة:**
        1.  اقترح هدفًا رقميًا جديدًا (\\\`suggested_target\\\`) يكون طموحًا وواقعيًا.
        2.  اكتب مبررًا (\\\`reasoning\\\`) لتحليلك باللغة العربية. يجب أن يذكر المبرر متوسط الأداء التاريخي والهدف المقترح.
        3.  **الأمر الأكثر أهمية:** يجب أن تبدأ جملة المبرر **حرفيًا** بالشكل التالي، مستخدمًا القيمة الدقيقة للمتوسط التاريخي المذكورة أعلاه: "بناءً على متوسط الأداء التاريخي البالغ ${historicalAverage.toFixed(2)}، فإن ...". **لا تستخدم أي جملة بداية أخرى تحت أي ظرف من الظروف.**

        قم بإرجاع النتيجة بتنسيق JSON فقط.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            suggested_target: { type: Type.NUMBER, description: "الهدف الرقمي المقترح." },
            reasoning: { type: Type.STRING, description: "شرح موجز للمنطق وراء الاقتراح باللغة العربية." }
        },
        required: ["suggested_target", "reasoning"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت خبير استراتيجي في عمليات الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};


export const generateCompetitionAnnouncement = async (
    winnerName: string,
    winnerScore: number,
    monthLabel: string
): Promise<{announcement: string}> => {
    const ai = getAI();
    const cacheKey = `comp_announcement_${winnerName}_${monthLabel}`;
    const cachedData = getFromCache<{announcement: string}>(cacheKey);
    if (cachedData) return cachedData;

    const prompt = `
        بصفتك الرئيس التنفيذي للعمليات، قم بصياغة إعلان احتفالي وحماسي للفائز بجائزة "مدير الشهر".
        
        بيانات الفائز:
        - اسم الفائز: ${winnerName}
        - الشهر: ${monthLabel}
        - النتيجة المحققة: ${winnerScore}%

        المطلوب:
        - كتابة نص إعلان ملهم باللغة العربية.
        - ابدأ بتهنئة حارة للفائز.
        - سلط الضوء على أن هذا الفوز جاء نتيجة للأداء المتميز والمبني على البيانات.
        - اختتم بتحفيز بقية الفريق وحثهم على المنافسة الشريفة في الأشهر القادمة.
        
        يجب أن يكون الرد بتنسيق JSON حصريًا.
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            announcement: { type: Type.STRING, description: "نص إعلان الفوز بجائزة مدير الشهر باللغة العربية." }
        },
        required: ["announcement"]
    };

     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت رئيس تنفيذي للعمليات، بارع في كتابة الإعلانات الداخلية المحفزة والاحتفالية. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};


const formatWinnerDataForPrompt = (winnerSnapshot: Manager): string => {
    return winnerSnapshot.pillars.map(pillar => {
        const pillarScore = calculatePillarScore(pillar);
        const kpiDetails = pillar.kpis.map(kpi => {
            const score = calculateKpiScore(kpi);
            const status = score >= 100 ? 'تجاوز الهدف' : 'حقق الهدف';
            return `  - ${kpi.name}: القيمة (${kpi.value.toFixed(1)}), الهدف (${kpi.target}), الأداء (${score}%) - ${status}`;
        }).join('\n');
        return `- ركيزة "${pillar.name}" (أداء ${pillarScore}%):\n${kpiDetails}`;
    }).join('\n\n');
};


export const generateWinnerAnalysis = async (
    winnerSnapshot: Manager,
    winnerScore: number,
    monthLabel: string
): Promise<{ analysis: string }> => {
    const ai = getAI();
    const cacheKey = `winner_analysis_${winnerSnapshot.id}_${monthLabel}`;
    const cachedData = getFromCache<{ analysis: string }>(cacheKey);
    if (cachedData) return cachedData;

    const performanceDetails = formatWinnerDataForPrompt(winnerSnapshot);

    const prompt = `
        بصفتك الرئيس التنفيذي للعمليات، قم بصياغة تحليل موجز ومُلهم لشرح أسباب فوز المدير بجائزة "مدير الشهر".
        
        بيانات الفوز:
        - اسم الفائز: ${winnerSnapshot.name}
        - الشهر: ${monthLabel}
        - النتيجة الإجمالية المحققة: ${winnerScore}%

        تفاصيل الأداء في ذلك الشهر:
        ${performanceDetails}

        المطلوب:
        - كتابة تحليل باللغة العربية يشرح سبب اختيار هذا المدير كفائز.
        - ركز على 1-2 من الركائز الرئيسية و2-3 من مؤشرات الأداء الرئيسية المحددة التي كان فيها أداء المدير استثنائيًا وشكلت الفارق.
        - يجب أن يكون التحليل احترافيًا ومحفزًا، ويوضح أن الاختيار مبني على بيانات دقيقة.
        
        يجب أن يكون الرد بتنسيق JSON حصريًا، يحتوي على حقل "analysis" فقط.
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            analysis: { type: Type.STRING, description: "تحليل موجز ومحفز لأسباب فوز المدير بالجائزة، مع ذكر الركائز والمؤشرات الرئيسية." }
        },
        required: ["analysis"]
    };

     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت رئيس تنفيذي للعمليات، بارع في تحليل الأداء وتقديم التقدير للموظفين المتميزين. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};

export type RootCauseAnalysis = {
  causes: {
    category: string;
    reasons: string[];
  }[];
};

export const generateRootCauseAnalysis = async (kpi: KPI, manager: Manager): Promise<RootCauseAnalysis> => {
    const ai = getAI();
    const cacheKey = `rca_${manager.id}_${kpi.id}`;
    const cachedData = getFromCache<RootCauseAnalysis>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع تحليل السبب الجذري من الذاكرة المؤقتة.");
        return cachedData;
    }

    const prompt = `
        أنت خبير عالمي في عمليات المناولة الأرضية ومتخصص في منهجيات تحليل الأسباب الجذرية مثل (Fishbone/Ishikawa).
        مهمتك هي تحليل ضعف الأداء في مؤشر أداء رئيسي معين لمدير وتحديد الأسباب الجذرية المحتملة.

        معلومات الحالة:
        - دور المدير: "${manager.role}"
        - اسم المؤشر: "${kpi.name}"
        - وصف المؤشر: "${kpi.tooltip.description}"
        - القيمة الحالية: ${kpi.value}
        - القيمة المستهدفة: ${kpi.target}
        - هل الأقل هو الأفضل؟: ${kpi.lowerIsBetter ? 'نعم' : 'لا'}

        بناءً على هذه المعلومات، قدم قائمة بالأسباب الجذرية المحتملة، مصنفة في الفئات التالية:
        - الأفراد (مثال: التدريب، التوظيف، الروح المعنوية)
        - العمليات (مثال: إجراءات العمل، التواصل، السياسات)
        - التكنولوجيا/المعدات (مثال: أعطال النظام، توفر المعدات، مشاكل الأدوات)
        - العوامل الخارجية (مثال: الطقس، ازدحام المطار، مشاكل متعلقة بشركات الطيران)

        لكل فئة، قدم 2-3 أسباب محتملة ومحددة.
        يجب أن يكون الناتج باللغة العربية وبتنسيق JSON المحدد حصريًا.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            causes: {
                type: Type.ARRAY,
                description: "قائمة بفئات الأسباب الجذرية.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        category: { type: Type.STRING, description: "اسم الفئة باللغة العربية (مثال: الأفراد, العمليات)." },
                        reasons: {
                            type: Type.ARRAY,
                            description: "قائمة بالأسباب المحتملة ضمن هذه الفئة.",
                            items: { type: Type.STRING, description: "سبب جذري محتمل ومحدد باللغة العربية." }
                        }
                    },
                    required: ["category", "reasons"]
                }
            }
        },
        required: ["causes"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت خبير عمليات طيران متخصص في تحليل الأسباب الجذرية. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};

export const generatePillarDiagnosis = async (
    pillarName: string,
    pillarScore: number,
    managersData: { managerName: string; kpiPerformances: { kpiName: string; score: number }[] }[]
): Promise<PillarDiagnosisResult> => {
    const ai = getAI();
    const managersSummary = managersData
        .map(m => {
            const lowKpis = m.kpiPerformances.filter(k => k.score < 90).map(k => `${k.kpiName} (${k.score}%)`).join(', ');
            return `- ${m.managerName}: ${lowKpis ? `نقاط الضعف في: ${lowKpis}` : 'أداء جيد ضمن هذا النطاق'}`;
        })
        .join('\n');

    const prompt = `
        أنت خبير استراتيجي في عمليات الطيران متخصص في تشخيص مشاكل الأداء.
        مهمتك هي تحليل انخفاض أداء ركيزة معينة، وتحديد المدراء الرئيسيين المسببين لهذا الانخفاض، وتقديم توصيات واضحة.

        **بيانات التحليل:**
        - **الركيزة:** "${pillarName}"
        - **متوسط أداء الركيزة:** ${pillarScore}% (يعتبر أي أداء أقل من 90% مجالاً للتحسين)
        - **ملخص أداء المدراء ضمن هذه الركيزة:**
        ${managersSummary}

        **المطلوب (باللغة العربية وبتنسيق JSON حصرياً):**
        1.  **analysis**: قدم تحليلاً موجزاً للوضع العام لهذه الركيزة، موضحاً سبب انخفاض الأداء.
        2.  **contributing_managers**: حدد قائمة بالمدراء الأكثر تأثيراً في انخفاض الأداء. لكل مدير، اذكر اسمه وسبباً موجزاً يوضح المؤشرات المحددة التي أثرت سلباً على أدائه.
        3.  **recommendations**: قدم 2-3 توصيات استراتيجية وعملية لمعالجة الأسباب الجذرية لهذا الانخفاض. يجب أن تكون كل توصية مرتبطة بالقسم (الدور الوظيفي) المناسب لتنفيذها.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            analysis: {
                type: Type.STRING,
                description: "تحليل موجز للوضع العام للركيزة باللغة العربية."
            },
            contributing_managers: {
                type: Type.ARRAY,
                description: "قائمة بالمدراء المساهمين في انخفاض الأداء.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        manager_name: { type: Type.STRING, description: "اسم المدير." },
                        reasoning: { type: Type.STRING, description: "شرح موجز للسبب مع ذكر المؤشرات." }
                    },
                    required: ["manager_name", "reasoning"]
                }
            },
            recommendations: {
                type: Type.ARRAY,
                description: "قائمة بالتوصيات.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING, description: "نص التوصية." },
                        targetRole: {
                            type: Type.STRING,
                            enum: ['RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'],
                            description: "القسم المستهدف للتوصية."
                        }
                    },
                    required: ["text", "targetRole"]
                }
            }
        },
        required: ["analysis", "contributing_managers", "recommendations"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت خبير استراتيجي في عمليات الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};


export const generateWhatIfAnalysis = async (
    kpi: KPI,
    newValue: number,
    stationScore: number
): Promise<WhatIfAnalysis> => {
    const ai = getAI();
    const prompt = `
        أنت مستشار استراتيجي أول في شركة طيران عالمية. مهمتك هي إجراء محاكاة "ماذا لو" (What-If) لتقييم التأثير المحتمل لتحسين مؤشر أداء رئيسي معين.
        
        السيناريو:
        - المؤشر المستهدف للتحسين: "${kpi.name}" (الوصف: ${kpi.tooltip.description})
        - القيمة الحالية للمؤشر: ${kpi.value}
        - الهدف الحالي للمؤشر: ${kpi.target}
        - القيمة الجديدة المقترحة للمحاكاة: ${newValue}
        - هل الأقل أفضل للمؤشر؟: ${kpi.lowerIsBetter ? 'نعم' : 'لا'}
        - الأداء العام الحالي للمحطة: ${stationScore}%

        المطلوب:
        قم بإجراء تحليل شامل بناءً على هذا السيناريو، مع الأخذ في الاعتبار العلاقات المتبادلة بين مؤشرات الأداء في عمليات المناولة الأرضية. يجب أن يكون الرد بتنسيق JSON حصريًا باللغة العربية وفقًا للهيكل التالي:
        
        1.  **simulation_summary**: ملخص موجز لتحليل السيناريو.
        2.  **overall_score_impact**: التأثير المتوقع على الأداء العام للمحطة. قدم القيمتين "from" و "to".
        3.  **related_kpis_impact**: قائمة بالتأثيرات المتسلسلة على مؤشرات أخرى ذات صلة. لكل تأثير، اذكر اسم المؤشر المتأثر ووصفًا للتأثير (مثال: "من المتوقع أن يتحسن الأداء في الوقت المحدد (OTP) نتيجة لتقليل وقت خدمة الطائرة").
        4.  **recommendations**: قائمة من 2-3 توصيات عالية المستوى لتحقيق هذا التحسين.
    `;

    const whatIfSchema = {
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
            recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
        required: ["simulation_summary", "overall_score_impact", "related_kpis_impact", "recommendations"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: whatIfSchema,
            systemInstruction: "أنت مستشار استراتيجي خبير في عمليات الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};

export const generateBulkRiskProfiles = async (managers: Manager[], timePeriod: TimePeriod): Promise<{ [managerId: string]: RiskProfile }> => {
    const ai = getAI();
    const cacheKey = `bulk_risk_profiles_${timePeriod}_${managers.map(m => m.id).join('-')}`;
    const cachedData = getFromCache<{ [managerId: string]: RiskProfile }>(cacheKey);
    if (cachedData) {
        return cachedData;
    }

    const RISK_KPI_IDS = new Set(KPI_CATEGORIES['السلامة والجودة والأمن']);

    const managersSummary = managers.map(manager => {
        const riskKpis = manager.pillars
            .flatMap(p => p.kpis)
            .filter(k => RISK_KPI_IDS.has(k.id));

        const riskKpiSummary = riskKpis.map(kpi => {
            const score = calculateKpiScore(kpi);
            const status = score >= 90 ? 'ضمن الهدف' : 'أقل من الهدف';
            return `- ${kpi.name}: القيمة (${kpi.value}), الهدف (${kpi.target}), الحالة: ${status}`;
        }).join('\n');

        const openActionPlans = manager.actionPlans.filter(p => p.steps.some(s => !s.isCompleted)).length;

        return `
---
Manager ID: ${manager.id}
الاسم: ${manager.name}
القسم: ${manager.department}
الدور: ${manager.role}
عدد خطط العمل المفتوحة: ${openActionPlans}
مؤشرات الأداء الرئيسية المتعلقة بالمخاطر:
${riskKpiSummary}
`;
    }).join('\n');


    const prompt = `
        أنت كبير مسؤولي المخاطر (CRO) في شركة مناولة أرضية. مهمتك هي تقييم ملف المخاطر لمجموعة من المدراء بناءً على بيانات السلامة والجودة والامتثال لكل منهم.

        بيانات المدراء:
        ${managersSummary}

        المطلوب:
        لكل مدير في القائمة، قم بتحليل بياناته وقدم تقييمًا لملف المخاطر الخاص به.
        1.  **risk_level**: صنف مستوى المخاطر الإجمالي للمدير إلى أحد المستويات التالية فقط: 'Low', 'Medium', 'High'.
        2.  **profile**: اكتب وصفًا موجزًا لملف المخاطر باللغة العربية. (مثال: "ملف مخاطر منخفض مع التزام جيد بمعايير السلامة.").
        3.  **reasoning**: قدم شرحًا موجزًا ومباشرًا باللغة العربية يوضح سبب تقييمك لمستوى المخاطر، مع الإشارة إلى مؤشرات أداء محددة أو عدد خطط العمل المفتوحة.

        يجب أن يكون الرد بتنسيق JSON حصريًا، ويحتوي على قائمة من الكائنات، كل كائن يحتوي على "manager_id" و "risk_profile" المقابل له.
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
                        risk_profile: {
                             type: Type.OBJECT,
                            properties: {
                                risk_level: {
                                    type: Type.STRING,
                                    enum: ['Low', 'Medium', 'High'],
                                    description: "مستوى المخاطر: 'Low', 'Medium', or 'High'."
                                },
                                profile: {
                                    type: Type.STRING,
                                    description: "وصف موجز لملف المخاطر باللغة العربية."
                                },
                                reasoning: {
                                    type: Type.STRING,
                                    description: "شرح سبب تقييم مستوى المخاطر باللغة العربية."
                                }
                            },
                            required: ["risk_level", "profile", "reasoning"]
                        }
                    },
                    required: ["manager_id", "risk_profile"]
                }
            }
        },
        required: ["profiles"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت كبير مسؤولي المخاطر. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });

    const jsonText = response.text.trim();
    // The schema returns { profiles: [{ manager_id: string, risk_profile: RiskProfile }] }
    const result: { profiles: { manager_id: string, risk_profile: RiskProfile }[] } = JSON.parse(jsonText);
    
    // Transform the array into a map for easier lookup
    const profilesMap: { [managerId: string]: RiskProfile } = {};
    for (const item of result.profiles) {
        profilesMap[item.manager_id] = item.risk_profile;
    }

    setInCache(cacheKey, profilesMap);
    return profilesMap;
};

export const generateMeetingSummary = async (manager: Manager, timePeriod: TimePeriod): Promise<{summary: string}> => {
    const ai = getAI();
    const cacheKey = `meeting_summary_${manager.id}_${timePeriod}`;
    const cachedData = getFromCache<{summary: string}>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع ملخص الاجتماع من الذاكرة المؤقتة.");
        return cachedData;
    }

    const overallScore = calculateManagerOverallScore(manager.pillars);
    const performanceSummary = manager.pillars.map(p => {
        const pillarScore = calculatePillarScore(p);
        const kpis = p.kpis.map(kpi => `${kpi.name} (${calculateKpiScore(kpi)}%)`).join(', ');
        return `- ${p.name} (${pillarScore}%): ${kpis}`;
    }).join('\n');
    
    const openActionPlans = manager.actionPlans.filter(p => p.steps.some(s => !s.isCompleted)).length;

    const prompt = `
        أنت مساعد تنفيذي ذكي. مهمتك هي إعداد ملخص أداء موجز للمدير لعرضه في اجتماع المراجعة.
        
        بيانات المدير:
        - الاسم: ${manager.name}
        - القسم: ${manager.department}
        - الأداء العام: ${overallScore}%
        - عدد خطط العمل المفتوحة: ${openActionPlans}
        - تفاصيل الأداء:
        ${performanceSummary}

        المطلوب:
        اكتب ملخصًا احترافيًا من 3-4 نقاط باللغة العربية. يجب أن يغطي الملخص:
        1.  الأداء العام للمدير.
        2.  أبرز نقاط القوة (أعلى الركائز أو المؤشرات أداءً).
        3.  أهم مجالات التحسين (أدنى الركائز أو المؤشرات أداءً).
        4.  إشارة إلى حالة خطط العمل.
        
        يجب أن يكون الرد بتنسيق JSON حصريًا يحتوي على مفتاح "summary".
    `;

     const schema = {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING, description: "ملخص أداء المدير بتنسيق Markdown باللغة العربية."}
        },
        required: ["summary"]
    };
     const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت مساعد تنفيذي ذكي. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};


export const askConversational = async (question: string, context: any, useGoogleSearch: boolean): Promise<GenerateContentResponse> => {
    const ai = getAI();
    let prompt: string;
    const config: any = {
        temperature: 0.2,
    };

    if (useGoogleSearch) {
        config.tools = [{ googleSearch: {} }];
        config.systemInstruction = "أنت مساعد بحث خبير. أجب على سؤال المستخدم باللغة العربية بناءً على نتائج البحث. كن شاملاً وموجزاً، واستشهد بالمصادر التي استخدمتها.";
        prompt = question;
    } else {
        config.systemInstruction = "أنت مساعد ذكاء اصطناعي خبير ومتخصص في تحليل بيانات الأداء لشركات المناولة الأرضية. اسمك \"Gemini\".\nيجب أن تكون جميع إجاباتك باللغة العربية الفصحى.\nاستند في إجاباتك **حصريًا** على البيانات المتوفرة في JSON. لا تخترع أي معلومات.\nإذا كان السؤال لا يمكن الإجابة عليه من البيانات المتاحة لدي، أجب بـ \"لا يمكنني الإجابة على هذا السؤال من البيانات المتاحة لدي.\"\nقدم إجابات مختصرة ومباشرة وذات رؤية تحليلية.\nاستخدم تنسيق الماركداون (Markdown) لجعل إجاباتك واضحة ومنظمة (مثل القوائم النقطية، النص الغامق، الجداول إذا لزم الأمر).";
        
        // Sanitize context to remove large, irrelevant data like history
        const leanContext = {
            currentView: context.currentView,
            selectedManagerId: context.selectedManagerId,
            managers: context.managers.map((manager: Manager) => ({
                id: manager.id,
                name: manager.name,
                department: manager.department,
                role: manager.role,
                overallScore: calculateManagerOverallScore(manager.pillars),
                pillars: manager.pillars.map((pillar: Pillar) => ({
                    id: pillar.id,
                    name: pillar.name,
                    weight: pillar.weight,
                    pillarScore: calculatePillarScore(pillar),
                    kpis: pillar.kpis.map((kpi: KPI) => ({
                        id: kpi.id,
                        name: kpi.name,
                        value: kpi.value,
                        target: kpi.target,
                        unit: kpi.unit,
                        lowerIsBetter: kpi.lowerIsBetter,
                        kpiScore: Math.round(calculateKpiScore(kpi))
                    }))
                }))
            }))
        };

        prompt = `
            البيانات الحالية:
            \`\`\`json
            ${JSON.stringify(leanContext, null, 2)}
            \`\`\`

            سؤال المستخدم: "${question}"
        `;
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: config
    });

    return response;
};

export const generateDiscrepancyAnalysis = async (procedureText: string, fileData: string, mimeType: string): Promise<ProcedureRiskAssessment> => {
    const ai = getAI();
    const filePart = {
        inlineData: {
            mimeType: mimeType,
            data: fileData
        }
    };
    const textPart = {
        text: `
        يرجى تحليل الإجراء التشغيلي الموضح أدناه ومقارنته بالدليل الرسمي للشركة المرفق كملف.
        بصفتك مدققًا خبيرًا في سلامة الطيران والامتثال للمعايير، قم بما يلي:

        1. **الإجراء الموصوف من قبل المدير:**
           """
           ${procedureText}
           """

        2. **المهمة:**
           أ. اقرأ وفهم الإجراء الذي وصفه المدير.
           ب. اقرأ الدليل الرسمي للشركة المرفق واستخرج المبادئ التوجيهية ذات الصلة.
           ج. قارن بدقة بين الممارسة الموصوفة والإرشادات الرسمية في الدليل.
           د. بناءً على هذه المقارنة، قم بإجراء تقييم شامل للمخاطر.

        3. **المطلوب (بتنسيق JSON حصرياً وباللغة العربية):**
           أ. **procedure_summary**: لخص الإجراء الذي وصفه المدير.
           ب. **compliance_analysis**: قدم تحليل امتثال مفصل.
           ج. **identified_risks**: قائمة بالمخاطر العامة المحددة بناءً على الإجراء وتحليل الامتثال.
           د. **mitigation_steps**: اقترح خطوات تخفيف واضحة لمعالجة المخاطر والفجوات في الامتثال.
           هـ. **overall_assessment**: قدم تقييمًا ختاميًا شاملاً.
        `
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            procedure_summary: { type: Type.STRING, description: "ملخص موجز للإجراء الموضح في الوثيقة باللغة العربية." },
            compliance_analysis: {
                type: Type.OBJECT,
                properties: {
                    overall_compliance_level: { type: Type.STRING, enum: ['متوافق', 'انحرافات طفيفة', 'انحرافات كبيرة', 'غير متوافق'], description: "التصنيف العام لمدى امتثال الإجراء للدليل." },
                    summary: { type: Type.STRING, description: "ملخص لتحليل الامتثال والفجوات المكتشفة." },
                    discrepancies: {
                        type: Type.ARRAY,
                        description: "قائمة بالانحرافات المكتشفة بين الإجراء الموصوف والدليل.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                described_practice: { type: Type.STRING, description: "الممارسة المحددة كما وصفها المدير." },
                                manual_guideline: { type: Type.STRING, description: "الإرشادات ذات الصلة من الدليل الرسمي." },
                                risk_implication: { type: Type.STRING, description: "الآثار المترتبة على المخاطر بسبب هذا الاختلاف." },
                            },
                            required: ["described_practice", "manual_guideline", "risk_implication"]
                        }
                    }
                },
                required: ["overall_compliance_level", "summary", "discrepancies"]
            },
            identified_risks: {
                type: Type.ARRAY,
                description: "قائمة بالمخاطر المحددة.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        risk_title: { type: Type.STRING, description: "عنوان وصفي للمخاطرة." },
                        risk_description: { type: Type.STRING, description: "وصف تفصيلي للمخاطرة وآثارها المحتملة." },
                        category: { type: Type.STRING, enum: ['السلامة', 'التشغيل', 'الأمن', 'العوامل البشرية', 'الامتثال'], description: "فئة المخاطرة." },
                        likelihood: { type: Type.STRING, enum: ['نادر', 'غير محتمل', 'محتمل', 'مرجح', 'شبه مؤكد'], description: "احتمالية وقوع المخاطرة." },
                        impact: { type: Type.STRING, enum: ['ضئيل', 'طفيف', 'متوسط', 'كبير', 'كارثي'], description: "حجم تأثير المخاطرة في حال وقوعها." }
                    },
                    required: ["risk_title", "risk_description", "category", "likelihood", "impact"]
                }
            },
            mitigation_steps: {
                type: Type.ARRAY,
                description: "قائمة بخطوات التخفيف المقترحة.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        step_title: { type: Type.STRING, description: "عنوان وصفي لخطوة التخفيف." },
                        step_description: { type: Type.STRING, description: "شرح تفصيلي للإجراء الموصى به." },
                        responsible_department: { type: Type.STRING, enum: ['RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'], description: "القسم المسؤول عن التنفيذ." }
                    },
                    required: ["step_title", "step_description", "responsible_department"]
                }
            },
            overall_assessment: { type: Type.STRING, description: "تقييم ختامي شامل لمستوى المخاطرة في الإجراء مع التوصية الرئيسية." }
        },
        required: ["procedure_summary", "compliance_analysis", "identified_risks", "mitigation_steps", "overall_assessment"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [textPart, filePart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت خبير عالمي في إدارة مخاطر الطيران (Aviation Risk Management) والتدقيق على الامتثال. قم بتحليل المدخلات المقدمة وتقديم تقييم شامل باللغة العربية وبتنسيق JSON."
        }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};


export const assessProcedureFromManual = async (procedureName: string, fileData: string, mimeType: string): Promise<StandardProcedureAssessment> => {
    const ai = getAI();
    const filePart = {
        inlineData: {
            mimeType: mimeType,
            data: fileData
        }
    };
    const textPart = {
        text: `
        أنت مدقق سلامة طيران دولي خبير (Lead ISAGO Auditor). مهمتك هي تقييم إجراء تشغيلي موثق في دليل الشركة المرفق، ومقارنته بأفضل الممارسات والمعايير العالمية (مثل دليل IATA للمناولة الأرضية AHM، ومعايير ISAGO، وممارسات المطارات الكبرى).

        1. **الإجراء المستهدف للتقييم من دليل الشركة:**
           """
           ${procedureName}
           """
        
        2. **المهمة:**
           أ. اقرأ الدليل الرسمي للشركة المرفق كملف.
           ب. ابحث عن القسم المتعلق بـ "${procedureName}" واستوعب الإجراءات الموضحة فيه.
           ج. **بناءً على معرفتك الواسعة كخبير في معايير الطيران العالمية، قارن إجراء الشركة الرسمي مع أفضل الممارسات العالمية.**
           د. قم بتحليل المخاطر **الكامنة** في إجراء الشركة، خاصة تلك التي تنشأ من أي انحرافات عن المعايير العالمية أو نقاط الضعف الموجودة حتى في الإجراءات القياسية.
           هـ. اقترح استراتيجيات تخفيف تهدف إلى سد الفجوات ورفع مستوى الإجراء ليتوافق مع أفضل الممارسات العالمية.

        3. **المطلوب (بتنسيق JSON حصرياً وباللغة العربية):**
           أ. **procedure_summary**: لخص الإجراء الرسمي كما هو موضح في دليل الشركة.
           ب. **inherent_risks**: قائمة بالمخاطر الكامنة التي تم تحديدها، مع التركيز على الانحرافات عن المعايير العالمية. لكل خطر، وضح كيف يختلف إجراء الشركة عن الممارسة العالمية المثلى إن أمكن.
           ج. **mitigation_strategies**: قائمة باستراتيجيات التخفيف المقترحة لتحسين الإجراء وجعله أكثر قوة وأمانًا، بهدف التوافق مع المعايير الدولية.
           د. **overall_assessment**: قدم تقييمًا ختاميًا شاملاً للمخاطر في الإجراء الرسمي للشركة مقارنة بالمعايير العالمية.
        `
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            procedure_summary: {
                type: Type.STRING,
                description: "ملخص موجز للإجراء الرسمي من الدليل."
            },
            inherent_risks: {
                type: Type.ARRAY,
                description: "قائمة بالمخاطر الكامنة في الإجراء الرسمي.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        risk_title: { type: Type.STRING, description: "عنوان المخاطرة." },
                        risk_description: { type: Type.STRING, description: "وصف المخاطرة." },
                        category: { type: Type.STRING, enum: ['السلامة', 'التشغيل', 'الأمن', 'العوامل البشرية', 'الامتثال'], description: "فئة المخاطرة." }
                    },
                    required: ["risk_title", "risk_description", "category"]
                }
            },
            mitigation_strategies: {
                type: Type.ARRAY,
                description: "قائمة باستراتيجيات التخفيف المقترحة.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        strategy_title: { type: Type.STRING, description: "عنوان الاستراتيجية." },
                        strategy_description: { type: Type.STRING, description: "وصف الاستراتيجية." },
                        responsible_department: {
                            type: Type.STRING,
                            enum: ['RAMP', 'PASSENGER', 'SUPPORT', 'SAFETY', 'TECHNICAL'],
                            description: "القسم المسؤول عن التنفيذ."
                        }
                    },
                    required: ["strategy_title", "strategy_description", "responsible_department"]
                }
            },
            overall_assessment: {
                type: Type.STRING,
                description: "تقييم ختامي شامل للمخاطر في الإجراء الرسمي."
            }
        },
        required: ["procedure_summary", "inherent_risks", "mitigation_strategies", "overall_assessment"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [textPart, filePart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت خبير استراتيجي في إدارة مخاطر الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};

export const generateTrainingScenario = async (kpi: KPI): Promise<TrainingScenario> => {
    const ai = getAI();
    const cacheKey = `training_scenario_${kpi.id}`;
    const cachedData = getFromCache<TrainingScenario>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع سيناريو التدريب من الذاكرة المؤقتة.");
        return cachedData;
    }

    const prompt = `
        أنت خبير عالمي في تطوير وتصميم برامج التدريب لقطاع الطيران، متخصص في عمليات المناولة الأرضية.
        مهمتك هي إنشاء سيناريو تدريبي تفاعلي وواقعي لموظفي العمليات، بهدف تحسين أدائهم في مؤشر أداء رئيسي معين.

        **معلومات المؤشر:**
        - **اسم المؤشر:** ${kpi.name}
        - **أهمية المؤشر:** ${kpi.tooltip.importance}
        - **الهدف:** ${kpi.target} (${kpi.lowerIsBetter ? 'القيمة الأقل أفضل' : 'القيمة الأعلى أفضل'})

        **المطلوب:**
        قم بإنشاء سيناريو تدريبي شامل باللغة العربية بناءً على هذا المؤشر. يجب أن يكون السيناريو قابلاً للاستخدام في جلسة تدريبية تفاعلية.
        
        **يجب أن يكون الرد بتنسيق JSON حصريًا وفقًا للهيكل التالي:**
        1.  **title**: عنوان جذاب للسيناريو التدريبي.
        2.  **learning_objective**: هدف تعليمي واضح ومحدد. ماذا يجب أن يكون المتدرب قادرًا على فعله بعد هذا التدريب؟
        3.  **scenario_description**: وصف مفصل ومحبوك لسيناريو واقعي يحدث في ساحة المطار ويتحدى المتدربين في المجال المتعلق بالمؤشر. (مثال: طقس سيء، ضغط وقت، معدات غير متوفرة، تواصل غير واضح).
        4.  **interactive_steps**: قائمة من 2 إلى 3 خطوات تفاعلية. كل خطوة يجب أن تحتوي على:
            - **step_title**: عنوان للخطوة.
            - **situation**: وصف لموقف معين ضمن السيناريو.
            - **question**: سؤال مباشر للمتدرب يضعه في موقف اتخاذ قرار.
            - **options**: قائمة من 3 خيارات (إجابات محتملة)، واحدة منها فقط هي الصحيحة. لكل خيار:
                - **option_text**: نص الخيار.
                - **is_correct**: قيمة بوليانية (true/false).
                - **feedback**: تغذية راجعة تشرح لماذا هذا الخيار صحيح أو خاطئ.
        5.  **debrief_points**: قائمة من 3 إلى 4 نقاط رئيسية لمناقشتها مع المتدربين بعد انتهاء السيناريو لترسيخ المفاهيم (نقاط الاستخلاص).
    `;
    
    const schema: any = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "عنوان السيناريو التدريبي باللغة العربية." },
            learning_objective: { type: Type.STRING, description: "الهدف التعليمي من السيناريو باللغة العربية." },
            scenario_description: { type: Type.STRING, description: "وصف مفصل للسيناريو باللغة العربية." },
            interactive_steps: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        step_title: { type: Type.STRING, description: "عنوان الخطوة التفاعلية." },
                        situation: { type: Type.STRING, description: "وصف الموقف في هذه الخطوة." },
                        question: { type: Type.STRING, description: "السؤال الموجه للمتدرب." },
                        options: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    option_text: { type: Type.STRING, description: "نص الخيار." },
                                    is_correct: { type: Type.BOOLEAN, description: "هل هذا هو الخيار الصحيح؟" },
                                    feedback: { type: Type.STRING, description: "التغذية الراجعة لهذا الخيار." }
                                },
                                required: ["option_text", "is_correct", "feedback"]
                            }
                        }
                    },
                    required: ["step_title", "situation", "question", "options"]
                }
            },
            debrief_points: { type: Type.ARRAY, items: { type: Type.STRING }, description: "نقاط رئيسية لمناقشتها بعد السيناريو." }
        },
        required: ["title", "learning_objective", "scenario_description", "interactive_steps", "debrief_points"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت خبير عالمي في تصميم برامج التدريب لقطاع الطيران. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};

export const generateAuditChecklist = async (prompt: string): Promise<GeneratedChecklist> => {
    const ai = getAI();
    const cacheKey = `audit_checklist_${prompt.substring(0, 100)}`;
    const cachedData = getFromCache<GeneratedChecklist>(cacheKey);
    if (cachedData) {
        toast.success("تم استرجاع قائمة التدقيق من الذاكرة المؤقتة.");
        return cachedData;
    }
    
    const fullPrompt = `
        أنت مدقق جودة وسلامة طيران دولي معتمد (Lead ISAGO Auditor). مهمتك هي إنشاء قائمة تدقيق (Checklist) شاملة ومفصلة بناءً على طلب المستخدم.
        يجب أن تكون بنود القائمة واضحة، قابلة للتحقق، ومصنفة بشكل منطقي.

        طلب المستخدم: "${prompt}"

        المطلوب:
        - إنشاء قائمة تدقيق تتراوح بين 10 و 20 بندًا.
        - تصنيف كل بند ضمن فئة منطقية (مثال: "فحص ما قبل التشغيل"، "التواصل والتنسيق"، "إجراءات السلامة").
        - **الأهم:** لكل بند، قم بتحديد مستوى المخاطرة المرتبطة به ('High', 'Medium', 'Low') بناءً على تأثيره المحتمل على السلامة أو التشغيل.
        - تأكد من أن البنود تغطي الجوانب الرئيسية للعملية المذكورة في طلب المستخدم، مع الأخذ في الاعتبار معايير السلامة والجودة العالمية.

        يجب أن يكون الرد بتنسيق JSON حصريًا وباللغة العربية.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            checklist_title: { type: Type.STRING, description: "عنوان وصفي لقائمة التدقيق باللغة العربية." },
            items: {
                type: Type.ARRAY,
                description: "قائمة ببنود التدقيق.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        item_text: { type: Type.STRING, description: "نص بند التدقيق القابل للتحقق." },
                        category: { type: Type.STRING, description: "الفئة التي ينتمي إليها البند." },
                        risk_level: {
                            type: Type.STRING,
                            enum: ['High', 'Medium', 'Low'],
                            description: "مستوى المخاطرة المرتبط بالبند ('High', 'Medium', 'Low')."
                        }
                    },
                    required: ["item_text", "category", "risk_level"]
                }
            }
        },
        required: ["checklist_title", "items"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: fullPrompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت مدقق جودة وسلامة طيران دولي معتمد. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    setInCache(cacheKey, result);
    return result;
};


export const generateHeatmapAnalysis = async (risks: RegisteredRisk[]): Promise<{ summary: string; priority_risks: { risk_title: string; reasoning: string }[] }> => {
    const ai = getAI();
    const riskSummary = risks.map(r => `- ${r.risk_title} (الاحتمالية: ${r.likelihood}, التأثير: ${r.impact})`).join('\n');

    const prompt = `
        أنت مدير مخاطر استراتيجي في قطاع الطيران. مهمتك هي تحليل توزيع المخاطر في الخريطة الحرارية وتقديم ملخص تنفيذي.

        قائمة المخاطر الحالية:
        ${riskSummary}

        المطلوب:
        1. **summary**: قدم ملخصًا تحليليًا باللغة العربية حول توزيع المخاطر. أين تتركز المخاطر؟ هل هناك أنماط ملحوظة (مثلاً، معظم المخاطر ذات تأثير كبير ولكن احتمالية منخفضة)؟
        2. **priority_risks**: حدد أهم 2-3 مخاطر تتطلب اهتمامًا فوريًا. لكل مخاطرة، اذكر عنوانها وسببًا موجزًا لأولويتها (مثلاً، "لأنها تقع في المنطقة الحمراء ذات الاحتمالية والتأثير المرتفعين").

        يجب أن يكون الرد بتنسيق JSON حصريًا وباللغة العربية.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            summary: { type: Type.STRING, description: "ملخص تحليلي لتوزيع المخاطر باللغة العربية." },
            priority_risks: {
                type: Type.ARRAY,
                description: "قائمة بأهم 2-3 مخاطر.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        risk_title: { type: Type.STRING, description: "عنوان المخاطرة." },
                        reasoning: { type: Type.STRING, description: "سبب موجز لأولوية المخاطرة." }
                    },
                    required: ["risk_title", "reasoning"]
                }
            }
        },
        required: ["summary", "priority_risks"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "أنت مدير مخاطر استراتيجي. قم بالرد بتنسيق JSON حصريًا باللغة العربية."
        }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};

export const generateStrategicGoal = async (
    idea: string,
): Promise<Omit<StrategicGoal, 'id'|'createdAt'>> => {
    const ai = getAI();
    const availableKpis = Object.values(ALL_KPIS).map(kpi => ({ id: kpi.id, name: kpi.name, description: kpi.tooltip.description }));
    
    const prompt = `
        You are a C-level strategic consultant for an aviation ground handling company. Your task is to transform a high-level idea into a SMART (Specific, Measurable, Achievable, Relevant, Time-bound) strategic goal, and identify the key performance indicators (KPIs) to track it.

        High-level idea: "${idea}"

        Available KPIs for tracking:
        \`\`\`json
        ${JSON.stringify(availableKpis)}
        \`\`\`

        Instructions:
        1.  **title**: Refine the high-level idea into a concise, professional, and inspiring strategic goal title in Arabic.
        2.  **description**: Write a brief, clear description in Arabic explaining the purpose and importance of this goal.
        3.  **timeframe**: Based on the goal's nature, suggest a timeframe. It must be either 'quarterly' or 'yearly'.
        4.  **linkedKpiIds**: From the provided JSON list of available KPIs, select the 3 to 5 most relevant KPI IDs that will be used to measure progress towards this goal. Return only the IDs in an array of strings.

        The response must be in JSON format only and in Arabic.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "The refined SMART goal title in Arabic." },
            description: { type: Type.STRING, description: "A brief description of the goal in Arabic." },
            timeframe: { type: Type.STRING, enum: ['quarterly', 'yearly'], description: "The suggested timeframe." },
            linkedKpiIds: {
                type: Type.ARRAY,
                description: "An array of the most relevant KPI IDs.",
                items: { type: Type.STRING }
            }
        },
        required: ["title", "description", "timeframe", "linkedKpiIds"]
    };

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            systemInstruction: "You are a C-level strategic consultant. Respond exclusively in JSON format with Arabic content."
        }
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText);
};