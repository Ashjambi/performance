// --- NEW TYPES ---
export type Comment = {
    id: string;
    author: string;
    text: string;
    createdAt: string; // ISO String
};

export type TimePeriod = 'monthly' | 'quarterly' | 'yearly';
export type ExecutiveTab = 'overview' | 'matrix' | 'risk_assessment' | 'action_hub';


export type ActionStep = {
    id: string;
    text: string;
    isCompleted: boolean;
    assignedTo?: string;
    dueDate?: string; // ISO String
};

export type ActionPlan = {
    id:string;
    originalRecommendation: string;
    steps: ActionStep[];
    createdAt: string; // ISO string
    comments: Comment[];
};

export type KPIHistory = {
  date: string; // ISO string
  value: number;
};

export type Alert = {
    id: string;
    managerId: string;
    managerName: string;
    kpiName: string;
    kpiScore: number;
    timestamp: string; // ISO String
    isRead: boolean;
};

export type WhatIfAnalysis = {
    simulation_summary: string;
    overall_score_impact: {
        from: number;
        to: number;
    };
    related_kpis_impact: {
        kpi_name: string;
        impact_description: string;
    }[];
    recommendations: string[];
};

export type RiskProfile = {
  profile: string;
  reasoning: string;
  risk_level: 'Low' | 'Medium' | 'High';
};

export type ProcedureRiskAssessment = {
  procedure_summary: string;
  compliance_analysis: {
    overall_compliance_level: 'متوافق' | 'انحرافات طفيفة' | 'انحرافات كبيرة' | 'غير متوافق';
    summary: string;
    discrepancies: {
      described_practice: string;
      manual_guideline: string;
      risk_implication: string;
    }[];
  };
  identified_risks: {
    risk_title: string;
    risk_description: string;
    category: 'السلامة' | 'التشغيل' | 'الأمن' | 'العوامل البشرية' | 'الامتثال';
    likelihood: 'نادر' | 'غير محتمل' | 'محتمل' | 'مرجح' | 'شبه مؤكد';
    impact: 'ضئيل' | 'طفيف' | 'متوسط' | 'كبير' | 'كارثي';
  }[];
  mitigation_steps: {
    step_title: string;
    step_description: string;
    responsible_department: ManagerRole;
  }[];
  overall_assessment: string;
};


// From types.js
export type KPI = {
  id: string;
  name: string;
  value: number;
  target: number;
  unit: 'percentage' | 'minutes' | 'per_1000_pax' | 'incidents' | 'score' | 'currency' | 'days' | 'per_1000_mov';
  lowerIsBetter: boolean;
  tooltip: {
    description: string;
    dataSource: string;
    importance: string;
  };
  history: KPIHistory[];
  benchmark?: {
    target: number;
    source: string;
  };
};

export type Pillar = {
  id: string;
  name: string;
  weight: number;
  iconName: 'ChartBarIcon' | 'ShieldCheckIcon' | 'BanknotesIcon' | 'UserGroupIcon' | 'HeartIcon' | 'ArchiveBoxIcon';
  kpis: KPI[];
};

export const ROLES = {
  RAMP: 'Ramp Operations',
  PASSENGER: 'Passenger Services',
  SUPPORT: 'Business Support',
  SAFETY: 'Safety & Quality',
  TECHNICAL: 'Technical Services',
} as const;

export type ManagerRole = keyof typeof ROLES;
export type ManagerRoleValue = typeof ROLES[ManagerRole];

export type Manager = {
  id:string;
  name: string;
  department: string;
  role: ManagerRole;
  pillars: Pillar[];
  actionPlans: ActionPlan[];
};

export type ManagerWithData = {
    id: string;
    name: string;
    score: number;
    riskProfile: RiskProfile | null;
};

export type Recommendation = {
    text: string;
    targetRole: ManagerRole;
};

export type AnalysisResult = {
  analysis: string;
  recommendations: Recommendation[];
};

export type CalculationField = {
  id: string;
  label: string;
};

export type CalculationFormula = {
    name: 'division_percent' | 'rate_per_1000' | 'simple_value' | 'average';
    input_ids: string[];
};

export type CalculationGuide = {
  title: string;
  objective: string;
  required_data: string[];
  steps: string[];
  example: string;
  tip: string;
  inputFields: CalculationField[];
  formula: CalculationFormula;
};


// A simple deep copy function
export const deepCopy = (obj: any) => JSON.parse(JSON.stringify(obj));


// From utils/kpiUtils.js
/**
 * Calculates a normalized score (0-100+) for a KPI based on its value and target.
 * It handles both cases where higher is better and lower is better.
 * @param kpi The KPI object.
 * @returns A score, typically around 100 for meeting the target.
 */
export const calculateKpiScore = (kpi: KPI): number => {
  if (kpi.target === 0) {
    if (kpi.lowerIsBetter) {
      return kpi.value === 0 ? 125 : 0;
    } else {
      return kpi.value > 0 ? 125 : 100;
    }
  }

  let score;
  if (kpi.lowerIsBetter) {
    score = (2 - kpi.value / kpi.target) * 100;
  } else {
    score = (kpi.value / kpi.target) * 100;
  }
  return Math.max(0, Math.round(Math.min(score, 150)));
};

export const calculatePillarScore = (pillar: Pillar): number => {
    if (!pillar.kpis || pillar.kpis.length === 0) return 0;
    const kpiScores = pillar.kpis.map(kpi => calculateKpiScore(kpi));
    const averageScore = kpiScores.reduce((sum, score) => sum + score, 0) / kpiScores.length;
    return Math.round(averageScore);
};

export const calculateManagerOverallScore = (pillars: Pillar[]): number => {
    if (!pillars || pillars.length === 0) return 0;

    const totalScore = pillars.reduce((acc, pillar) => {
        // use calculatePillarScore to find the score for each pillar first
        const pillarScore = calculatePillarScore(pillar);
        // Then, weigh it by the pillar's weight
        return acc + pillarScore * (pillar.weight / 100);
    }, 0);
    
    return Math.round(totalScore);
};

export const calculatePeerAverageForKpi = (
    managers: Manager[],
    targetManagerId: string,
    kpiId: string
): number | null => {
    const targetManager = managers.find(m => m.id === targetManagerId);
    if (!targetManager) return null;

    const peers = managers.filter(
        m => m.id !== targetManagerId && m.role === targetManager.role
    );

    if (peers.length === 0) return null;

    const peerValues: number[] = [];
    peers.forEach(peer => {
        peer.pillars.forEach(pillar => {
            const kpi = pillar.kpis.find(k => k.id === kpiId);
            if (kpi) {
                peerValues.push(kpi.value);
            }
        });
    });

    if (peerValues.length === 0) return null;

    const sum = peerValues.reduce((acc, val) => acc + val, 0);
    return sum / peerValues.length;
};


// --- AGGREGATION ENGINE ---
export const getAggregatedKpiValue = (
    kpi: KPI,
    period: TimePeriod
): number => {
    if (period === 'monthly' || !kpi.history || kpi.history.length === 0) {
        return kpi.value;
    }

    const historySlice = period === 'quarterly' ? kpi.history.slice(-3) : kpi.history.slice(-12);
    
    if (historySlice.length === 0) {
        return kpi.value; // Fallback to current value if no history for the period
    }

    const sum = historySlice.reduce((acc, h) => acc + h.value, 0);
    const average = sum / historySlice.length;

    if (kpi.unit === 'percentage' || kpi.unit === 'score' || kpi.unit === 'minutes') {
        return parseFloat(average.toFixed(1));
    }
    return parseFloat(average.toFixed(2));
};

export const getManagerSnapshotForPeriod = (
    manager: Manager,
    period: TimePeriod
): Manager => {
    if (period === 'monthly') {
        return manager; // No need to copy or calculate for monthly
    }

    const managerSnapshot = deepCopy(manager);
    const originalManager = INITIAL_MANAGERS_DATA.find(m => m.id === manager.id) || manager;


    for (const pillar of managerSnapshot.pillars) {
        for (const kpi of pillar.kpis) {
            const originalKpi = originalManager.pillars.flatMap(p => p.kpis).find(ok => ok.id === kpi.id);
            if (originalKpi) {
                 kpi.value = getAggregatedKpiValue(originalKpi, period);
            }
        }
    }

    return managerSnapshot;
};

// --- COMPETITION ENGINE ---

/**
 * Gets a list of unique months from all manager histories for the competition dropdown.
 * @param managers Array of all managers.
 * @returns An array of objects with label and value for the dropdown.
 */
export const getAvailableMonthsForCompetition = (managers: Manager[]): { label: string; value: string }[] => {
    const monthSet = new Set<string>();

    managers.forEach(manager => {
        manager.pillars.forEach(pillar => {
            pillar.kpis.forEach(kpi => {
                kpi.history.forEach(h => {
                    monthSet.add(h.date.substring(0, 7)); // 'YYYY-MM'
                });
            });
        });
    });

    const sortedMonths = Array.from(monthSet).sort().reverse();

    return sortedMonths.map(monthStr => {
        const date = new Date(monthStr + '-02'); // Use day 2 to avoid timezone issues
        const label = date.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });
        return { label, value: monthStr };
    });
};


/**
 * Calculates a manager's overall score for a specific historical month.
 * @param manager The manager object.
 * @param monthIdentifier The month to calculate for, e.g., '2024-05'.
 * @returns The score for that month, or null if data is incomplete.
 */
export const calculateManagerScoreForMonth = (manager: Manager, monthIdentifier: string): number | null => {
    const managerSnapshot = deepCopy(manager);
    let allKpisFoundForMonth = true;

    for (const pillar of managerSnapshot.pillars) {
        for (const kpi of pillar.kpis) {
            const historyEntry = kpi.history.find(h => h.date.startsWith(monthIdentifier));
            if (historyEntry) {
                kpi.value = historyEntry.value;
            } else {
                allKpisFoundForMonth = false;
                break; // This KPI is missing data for the month
            }
        }
        if (!allKpisFoundForMonth) break; // No need to check other pillars
    }

    if (!allKpisFoundForMonth) {
        return null; // Manager cannot be scored for this month due to incomplete data
    }

    return calculateManagerOverallScore(managerSnapshot.pillars);
};

/**
 * Creates a "snapshot" of a manager for a specific historical month.
 * @param manager The manager object.
 * @param monthIdentifier The month to create the snapshot for, e.g., '2024-05'.
 * @returns A deep copy of the manager object with KPI values set to their historical values for that month, or null if data is incomplete.
 */
export const getManagerSnapshotForMonth = (manager: Manager, monthIdentifier: string): Manager | null => {
    const managerSnapshot = deepCopy(manager);
    let allKpisFoundForMonth = true;

    for (const pillar of managerSnapshot.pillars) {
        for (const kpi of pillar.kpis) {
            const historyEntry = kpi.history.find(h => h.date.startsWith(monthIdentifier));
            if (historyEntry) {
                kpi.value = historyEntry.value;
            } else {
                allKpisFoundForMonth = false;
                break; // This KPI is missing data for the month
            }
        }
        if (!allKpisFoundForMonth) break; // No need to check other pillars
    }

    if (!allKpisFoundForMonth) {
        return null; // Manager cannot be evaluated for this month due to incomplete data
    }

    return managerSnapshot;
};


// --- FORECASTING ENGINE ---

/**
 * Calculates the slope (m) and y-intercept (b) for a set of data points.
 * @param data An array of objects with x and y properties.
 * @returns An object with m and b.
 */
export const calculateLinearRegression = (data: { x: number; y: number }[]): { m: number; b: number } => {
    const n = data.length;
    if (n < 2) return { m: 0, b: data[0]?.y || 0 };

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (const point of data) {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
    }

    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    return { m, b };
};

/**
 * Forecasts the next value for a KPI based on its history.
 * @param kpi The KPI object with its history.
 * @returns The forecasted value, or null if not possible.
 */
export const forecastKpiValue = (kpi: KPI): number | null => {
    if (!kpi.history || kpi.history.length < 2) return null;

    const data = kpi.history.map((h, index) => ({ x: index, y: h.value }));
    const { m, b } = calculateLinearRegression(data);

    // Forecast for the next point in time (x = data.length)
    const forecastedValue = m * data.length + b;
    return parseFloat(forecastedValue.toFixed(2));
};

/**
 * Forecasts the overall station score based on the historical performance of all managers.
 * @param managers The array of all managers.
 * @returns An object with the station's historical performance and the forecasted score.
 */
export const forecastStationScore = (managers: Manager[]): { stationHistory: KPIHistory[], forecastedScore: number | null } => {
    if (!managers || managers.length === 0) return { stationHistory: [], forecastedScore: null };

    // Find a reference history length (assuming all histories are synced)
    const historyLength = managers[0]?.pillars[0]?.kpis[0]?.history?.length || 0;
    if (historyLength < 2) return { stationHistory: [], forecastedScore: null };

    const stationHistory: KPIHistory[] = [];

    for (let i = 0; i < historyLength; i++) {
        let totalScoreForTimeStep = 0;
        let managersInTimeStep = 0;

        for (const manager of managers) {
            const managerPillarsSnapshot: Pillar[] = [];
            let canCalculateManager = true;

            for (const pillar of manager.pillars) {
                const pillarKpisSnapshot: KPI[] = [];
                for (const kpi of pillar.kpis) {
                    if (kpi.history && kpi.history[i]) {
                        pillarKpisSnapshot.push({ ...kpi, value: kpi.history[i].value });
                    } else {
                        canCalculateManager = false;
                        break;
                    }
                }
                if (!canCalculateManager) break;
                managerPillarsSnapshot.push({ ...pillar, kpis: pillarKpisSnapshot });
            }

            if (canCalculateManager && managerPillarsSnapshot.length > 0) {
                totalScoreForTimeStep += calculateManagerOverallScore(managerPillarsSnapshot);
                managersInTimeStep++;
            }
        }
        
        if (managersInTimeStep > 0) {
            const date = managers[0].pillars[0].kpis[0].history[i].date;
            stationHistory.push({
                date: date,
                value: Math.round(totalScoreForTimeStep / managersInTimeStep)
            });
        }
    }

    if (stationHistory.length < 2) return { stationHistory, forecastedScore: null };

    const data = stationHistory.map((h, index) => ({ x: index, y: h.value }));
    const { m, b } = calculateLinearRegression(data);
    const forecastedScore = m * data.length + b;

    return { stationHistory, forecastedScore: Math.round(forecastedScore) };
};


const generateHistory = (initialValue: number, isLowerBetter: boolean) => {
    const history: KPIHistory[] = [];
    let currentValue = initialValue;
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const fluctuation = (Math.random() - 0.5) * (initialValue * 0.1); // +/- 5% fluctuation
        currentValue = currentValue + (isLowerBetter ? -fluctuation : fluctuation);
        history.push({ date: date.toISOString(), value: parseFloat(currentValue.toFixed(2)) });
    }
    return history;
}

// --- MASTER KPI DEFINITIONS ---
export const ALL_KPIS: Record<string, Omit<KPI, 'value' | 'history'>> = {
    absenteeism_rate: {
        id: 'absenteeism_rate', name: 'معدل الغياب', target: 3, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'نسبة أيام الغياب غير المخطط له إلى إجمالي أيام العمل.', dataSource: 'HRMS', importance: 'قد يكون مؤشراً على ضغط العمل أو انخفاض الرضا الوظيفي.' }
    },
    accident_rate: {
        id: 'accident_rate', name: 'معدل الحوادث والإصابات', target: 1.0, unit: 'incidents', lowerIsBetter: true,
        tooltip: { description: 'عدد الحوادث الجسيمة لكل 10,000 رحلة.', dataSource: 'تقارير السلامة', importance: 'يعكس بشكل مباشر ثقافة السلامة.' },
    },
    aircraft_waiting_time: {
        id: 'aircraft_waiting_time', name: 'وقت انتظار الطائرة للخدمة', target: 5, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'الوقت الذي تنتظره الطائرة قبل بدء الخدمة بسبب تأخير من جانب المناولة الأرضية.', dataSource: 'سجلات التشغيل, AIMS', importance: 'يؤثر على إجمالي وقت خدمة الطائرة (TAT) ورضا شركات الطيران.' }
    },
    airline_complaint_index: {
        id: 'airline_complaint_index', name: 'مؤشر شكاوى شركات الطيران', target: 8, unit: 'per_1000_mov', lowerIsBetter: true,
        tooltip: { description: 'عدد الشكاوى الرسمية المسجلة من شركات الطيران لكل 1000 حركة طيران تتم خدمتها.', dataSource: 'نظام إدارة علاقات العملاء (CRM)، سجلات الشكاوى', importance: 'مؤشر مباشر لجودة الخدمة المقدمة لشركات الطيران والالتزام باتفاقيات مستوى الخدمة (SLA).' }
    },
    airline_satisfaction_percent: {
        id: 'airline_satisfaction_percent', name: 'مستوى رضا شركات الطيران (نسبة)', target: 90, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للتقييمات الإيجابية (مثل "راضٍ" أو "راضٍ جدًا") من إجمالي استبيانات رضا شركات الطيران.', dataSource: 'استبيانات دورية, CRM', importance: 'مؤشر مباشر لرضا العملاء الرئيسيين (شركات الطيران).' }
    },
    airline_satisfaction_score: {
        id: 'airline_satisfaction_score', name: 'رضا شركات الطيران (نقاط)', target: 4.2, unit: 'score', lowerIsBetter: false,
        tooltip: { description: 'متوسط التقييم من استطلاعات رضا شركات الطيران الدورية (على مقياس من 1 إلى 5 نقاط).', dataSource: 'استطلاعات دورية', importance: 'مؤشر حاسم للعلاقة مع العملاء (شركات الطيران) واستمرارية الأعمال.' }
    },
    audit_compliance: {
        id: 'audit_compliance', name: 'نتيجة تدقيق السلامة', target: 95, unit: 'score', lowerIsBetter: false,
        tooltip: { description: 'النتيجة المحققة في عمليات تدقيق السلامة الميدانية الداخلية والخارجية (مثل ISAGO).', dataSource: 'تقارير التدقيق', importance: 'يؤكد على الالتزام بالمعايير العالمية للسلامة (ISAGO) وجودة العمليات.' }
    },
    audit_findings_per_audit: {
        id: 'audit_findings_per_audit', name: 'معدل المخالفات لكل تدقيق', target: 1, unit: 'incidents', lowerIsBetter: true,
        tooltip: { description: 'متوسط عدد حالات عدم الامتثال أو المخالفات التي يتم اكتشافها في كل عملية تدقيق جودة أو سلامة.', dataSource: 'تقارير التدقيق الداخلي والخارجي', importance: 'انخفاض هذا المعدل يدل على نضج وقوة نظام الجودة والسلامة.' }
    },
    audit_item_compliance_rate: {
        id: 'audit_item_compliance_rate', name: 'معدل الامتثال لبنود التدقيق', target: 95, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية لبنود الامتثال التي تم تحقيقها بنجاح ضمن عمليات التدقيق (مثل ISAGO) من إجمالي البنود المدققة.', dataSource: 'تقارير التدقيق الداخلي والخارجي', importance: 'يقيس مدى الالتزام التفصيلي بالإجراءات والمعايير العالمية للسلامة والجودة.' }
    },
    avg_turnaround_time: {
        id: 'avg_turnaround_time', name: 'متوسط وقت خدمة الطائرة (TAT)', target: 40, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'الوقت من توقف الطائرة حتى جاهزية الإقلاع.', dataSource: 'سجلات التشغيل', importance: 'مؤشر أساسي في كل اتفاقية مستوى خدمة (SLA) ويؤثر مباشرة على رضا شركات الطيران.' },
        benchmark: { target: 35, source: 'Airline SLA' }
    },
    baggage_accuracy: {
        id: 'baggage_accuracy', name: 'معدل الأمتعة المفقودة', target: 2.0, unit: 'per_1000_pax', lowerIsBetter: true,
        tooltip: { description: 'عدد الحقائب المفقودة أو التي أسيئت مناولتها لكل 1000 راكب.', dataSource: 'نظام تتبع الأمتعة العالمي (WorldTracer)', importance: 'مؤشر حاسم لرضا الركاب وسمعة شركة الطيران، ويتم مقارنته عالميًا وفقًا لمعايير WCHR.' },
        benchmark: { target: 1.5, source: 'SITA Report' }
    },
    baggage_damage_rate: {
        id: 'baggage_damage_rate', name: 'معدل تلف الأمتعة', target: 0.2, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'نسبة الأمتعة التي تعرضت للضرر أثناء التحميل والتفريغ.', dataSource: 'تقارير المطالبات والأضرار', importance: 'مؤشر سلامة وجودة يؤثر على التكاليف وسمعة الشركة.' }
    },
    baggage_damage_rate_per_1000: {
        id: 'baggage_damage_rate_per_1000', name: 'معدل تلف الأمتعة (لكل 1000 حقيبة)', target: 0.5, unit: 'per_1000_pax', lowerIsBetter: true,
        tooltip: { description: 'عدد شكاوى تلف الأمتعة المؤكدة لكل 1000 قطعة أمتعة تمت مناولتها.', dataSource: 'تقارير المطالبات، نظام مناولة الأمتعة', importance: 'مؤشر جودة حاسم يؤثر على التكاليف المباشرة ورضا العملاء وشركات الطيران.' }
    },
    baggage_loading_time: {
        id: 'baggage_loading_time', name: 'وقت تحميل الأمتعة', target: 20, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'متوسط الوقت المستغرق لتحميل جميع أمتعة رحلة مغادرة.', dataSource: 'نظام مناولة الأمتعة (BHS)', importance: 'متطلب أساسي في اتفاقيات مستوى الخدمة (SLA) ويؤثر على المغادرة في الوقت المحدد.' }
    },
    boarding_gate_performance: {
        id: 'boarding_gate_performance', name: 'الالتزام بوقت إغلاق البوابة', target: 98, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة الرحلات التي تم فيها إغلاق بوابة الصعود للطائرة في الوقت المحدد دون تأخير.', dataSource: 'نظام التحكم في المغادرة (DCS)', importance: 'مؤشر حاسم لضمان إقلاع الرحلات في وقتها المحدد وتحقيق رضا العملاء.' }
    },
    boarding_pass_accuracy: {
        id: 'boarding_pass_accuracy', name: 'معدل دقة إصدار بطاقات الصعود', target: 99.5, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة بطاقات الصعود التي تم إصدارها بشكل صحيح دون الحاجة لإعادة طباعة أو تصحيح.', dataSource: 'نظام التحكم في المغادرة (DCS)', importance: 'يعكس كفاءة موظفي التسجيل ويقلل من تأخير الركاب.' }
    },
    boarding_time: {
        id: 'boarding_time', name: 'وقت إنهاء إجراءات الصعود للطائرة', target: 25, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'إجمالي الوقت المستغرق من فتح البوابة حتى إغلاقها لصعود جميع الركاب.', dataSource: 'نظام التحكم في المغادرة (DCS)', importance: 'الكفاءة في هذا المؤشر ضرورية لضمان المغادرة في الوقت المحدد (OTP).' }
    },
    budget_adherence: {
        id: 'budget_adherence', name: 'الالتزام بالميزانية', target: 100, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'نسبة المصروفات الفعلية إلى الميزانية المعتمدة.', dataSource: 'النظام المالي (ERP)', importance: 'يقيس القدرة على التحكم في التكاليف.' }
    },
    checkin_queue_time: {
        id: 'checkin_queue_time', name: 'متوسط وقت الانتظار عند التسجيل', target: 5, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'متوسط المدة التي ينتظرها المسافر في طابور كاونترات التسجيل.', dataSource: 'مراقبة الكاميرات، دراسات ميدانية', importance: 'يؤثر على رضا الركاب المغادرين وانسيابية الحركة في المطار.' }
    },
    checkin_time: {
        id: 'checkin_time', name: 'وقت إنهاء إجراءات السفر', target: 3, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'متوسط الوقت المستغرق لخدمة راكب واحد عند كاونترات إنهاء إجراءات السفر.', dataSource: 'نظام التحكم في المغادرة (DCS)', importance: 'يؤثر على انسيابية تدفق الركاب ورضاهم.' }
    },
    contract_renewal_rate: {
        id: 'contract_renewal_rate', name: 'معدل تجديد العقود', target: 85, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للعقود التي يتم تجديدها من قبل شركات الطيران عند انتهاء مدتها.', dataSource: 'نظام إدارة العقود', importance: 'يعكس رضا العملاء على المدى الطويل والثقة في الخدمة المقدمة.' }
    },
    corrective_action_closure_rate: {
        id: 'corrective_action_closure_rate', name: 'معدل إغلاق الإجراءات التصحيحية', target: 95, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للإجراءات التصحيحية الناتجة عن التدقيق التي تم إغلاقها ضمن الإطار الزمني المحدد.', dataSource: 'SMS', importance: 'يضمن معالجة ملاحظات السلامة والجودة بشكل فعال.' }
    },
    cost_per_turnaround: {
        id: 'cost_per_turnaround', name: 'تكلفة خدمة الطائرة الواحدة', target: 4800, unit: 'currency', lowerIsBetter: true,
        tooltip: { description: 'إجمالي تكاليف القسم التشغيلية / عدد الرحلات.', dataSource: 'النظام المالي، بيانات التشغيل', importance: 'مؤشر شامل للكفاءة المالية للقسم.' }
    },
    denied_boarding_rate: {
        id: 'denied_boarding_rate', name: 'معدل منع الصعود للطائرة', target: 0.1, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'نسبة الركاب الذين مُنعوا من السفر لأسباب تشغيلية كالحجوزات الزائدة.', dataSource: 'تقارير نظام الحجز، DCS', importance: 'يؤثر بشدة على السمعة وقد تترتب عليه تكاليف تعويضات عالية.' }
    },
    employee_turnover: {
        id: 'employee_turnover', name: 'معدل دوران الموظفين', target: 0.8, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'النسبة المئوية الشهرية للموظفين الذين تركوا العمل.', dataSource: 'HRMS', importance: 'قد يدل على بيئة عمل سيئة أو مشاكل في الإدارة.' }
    },
    equipment_downtime: {
        id: 'equipment_downtime', name: 'نسبة توقف المعدات', target: 2, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'النسبة المئوية لوقت توقف المعدات عن العمل بسبب الأعطال.', dataSource: 'نظام إدارة الصيانة (CMMS)', importance: 'مؤشر جودة صيانة يعكس موثوقية المعدات الأرضية.' }
    },
    first_bag_delivery: {
        id: 'first_bag_delivery', name: 'وقت تسليم الحقيبة الأولى', target: 15, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'الوقت من وقوف الطائرة حتى وصول أول حقيبة إلى سير الأمتعة.', dataSource: 'سجلات نظام مناولة الأمتعة (BHS)', importance: 'مؤشر رئيسي يؤثر بشكل مباشر على تجربة الركاب القادمين.' },
        benchmark: { target: 12, source: 'ACI ASQ' }
    },
    first_time_fix_rate: {
        id: 'first_time_fix_rate', name: 'معدل الإصلاح من المرة الأولى', target: 90, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة الأعطال التي تم إصلاحها بنجاح من المحاولة الأولى.', dataSource: 'CMMS', importance: 'يعكس كفاءة وجودة أعمال الصيانة.' }
    },
    fod_incidents: {
        id: 'fod_incidents', name: 'حوادث الأجسام الغريبة (FOD)', target: 0, unit: 'incidents', lowerIsBetter: true,
        tooltip: { description: 'عدد الحوادث المتعلقة بالأجسام الغريبة (Foreign Object Debris) على ساحة المطار.', dataSource: 'تقارير السلامة اليومية', importance: 'مؤشر سلامة حاسم لمنع تلف محركات الطائرات.' }
    },
    forecasting_accuracy: {
        id: 'forecasting_accuracy', name: 'دقة التنبؤ بالعمليات', target: 10, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'نسبة الخطأ بين حجم العمليات المتوقع والفعلي (مثال: عدد الرحلات، الركاب).', dataSource: 'بيانات التخطيط والتشغيل', importance: 'تحسين دقة التنبؤ يساعد في تخطيط الموارد بشكل أفضل.' }
    },
    formal_complaints: {
        id: 'formal_complaints', name: 'عدد الشكاوى الرسمية', target: 3, unit: 'incidents', lowerIsBetter: true,
        tooltip: { description: 'العدد الإجمالي للشكاوى المسجلة من شركات الطيران أو الركاب.', dataSource: 'نظام CRM', importance: 'انخفاضه يدل على أداء عالٍ ورضا العملاء.' },
    },
    fuel_consumption_per_flight: {
        id: 'fuel_consumption_per_flight', name: 'استهلاك الوقود لكل رحلة', target: 150, unit: 'score', lowerIsBetter: true,
        tooltip: { description: 'متوسط كمية الوقود (باللتر) التي تستهلكها المعدات الأرضية لخدمة رحلة واحدة.', dataSource: 'سجلات الوقود', importance: 'مؤشر للاستدامة البيئية والكفاءة في استخدام الموارد.' }
    },
    fuel_spill_incidents: {
        id: 'fuel_spill_incidents', name: 'حوادث انسكاب الوقود', target: 0, unit: 'incidents', lowerIsBetter: true,
        tooltip: { description: 'العدد الإجمالي لحالات انسكاب الوقود أثناء عمليات التزويد.', dataSource: 'تقارير السلامة والبيئة', importance: 'مؤشر سلامة وبيئة حرج يهدف إلى صفر حوادث تسرب.' }
    },
    fueling_accuracy: {
        id: 'fueling_accuracy', name: 'دقة التزود بالوقود', target: 100, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'مدى مطابقة كمية الوقود المسلمة للكمية المطلوبة في خطة الرحلة.', dataSource: 'سجلات شركة الوقود, خطط الرحلات', importance: 'جزء من اتفاقيات SLA ويضمن سلامة الرحلات.' }
    },
    ground_damage_rate: {
        id: 'ground_damage_rate', name: 'معدل الأضرار الأرضية', target: 0.1, unit: 'per_1000_mov', lowerIsBetter: true,
        tooltip: { description: 'عدد حوادث الأضرار التي تلحق بالطائرات أو المعدات الأرضية لكل 1000 حركة.', dataSource: 'تقارير السلامة', importance: 'مؤشر سلامة حرج يهدف إلى تحقيق صفر أضرار، وهو من أهم مقاييس الأداء.' },
        benchmark: { target: 0.08, source: 'IATA ISAGO' }
    },
    ground_transport_availability: {
        id: 'ground_transport_availability', name: 'معدل توفر وسائل النقل', target: 90, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية لمركبات النقل الأرضي (للطواقم والركاب) المتاحة للعمل.', dataSource: 'سجلات الصيانة والتشغيل', importance: 'يضمن انسيابية حركة الأفراد في ساحة المطار.' }
    },
    gse_availability: {
        id: 'gse_availability', name: 'نسبة توفر المعدات الأرضية (GSE)', target: 98, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة الوقت الذي تكون فيه المعدات جاهزة للعمل من إجمالي ساعات التشغيل المتاحة.', dataSource: 'سجلات الصيانة', importance: 'أساس الكفاءة التشغيلية؛ يضمن توفر المعدات اللازمة للعمليات دون تأخير.' }
    },
    gse_utilization: {
        id: 'gse_utilization', name: 'استغلال المعدات الأرضية (GSE)', target: 85, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية لوقت استخدام المعدات مقابل الوقت المتاح.', dataSource: 'نظام تتبع المعدات (GPS)', importance: 'يقيس كفاءة استخدام الأصول.' }
    },
    handling_delay_rate: {
        id: 'handling_delay_rate', name: 'نسبة التأخير بسبب المناولة', target: 1.0, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'النسبة المئوية للرحلات التي تأخرت بسبب خطأ أو تأخير من جانب عمليات المناولة الأرضية.', dataSource: 'تقارير التأخير (Delay Codes)', importance: 'مؤشر رئيسي لتقييم التأثير المباشر للمناولة على انتظام الرحلات.' }
    },
    incident_complaint_rate: {
        id: 'incident_complaint_rate', name: 'معدل الحوادث والشكاوى', target: 2.0, unit: 'per_1000_mov', lowerIsBetter: true,
        tooltip: { description: 'إجمالي عدد الحوادث والشكاوى المسجلة لكل 1000 رحلة أو حركة.', dataSource: 'نظام إدارة السلامة (SMS), CRM', importance: 'مؤشر شامل يجمع بين السلامة وجودة الخدمة.' }
    },
    injury_rate_osha: {
        id: 'injury_rate_osha', name: 'معدل الإصابات (OSHA)', target: 2.0, unit: 'incidents', lowerIsBetter: true,
        tooltip: { description: 'معدل الإصابات المسجلة لكل 200,000 ساعة عمل، وفقاً لمعايير OSHA للسلامة.', dataSource: 'تقارير السلامة والموارد البشرية', importance: 'مقياس عالمي لسلامة الموظفين في مكان العمل.' }
    },
    last_bag_delivery: {
        id: 'last_bag_delivery', name: 'وقت تسليم الحقيبة الأخيرة', target: 30, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'الوقت من وقوف الطائرة حتى وصول آخر حقيبة إلى سير الأمتعة.', dataSource: 'سجلات نظام مناولة الأمتعة (BHS)', importance: 'مؤشر هام يقيس الكفاءة الإجمالية لعملية تفريغ الأمتعة.' }
    },
    loading_accuracy: {
        id: 'loading_accuracy', name: 'دقة تحميل الأمتعة والبضائع', target: 99.8, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة التحميل الصحيح للأمتعة والبضائع بدون أخطاء أو أضرار.', dataSource: 'تقارير الأضرار، نظام إدارة الحمولة', importance: 'يؤثر على سلامة الطائرة ويمنع تكاليف الأضرار وتأخير الرحلات. يتم قياسه وفقًا لمعايير IATA BRS.' }
    },
    marshalling_accuracy: {
        id: 'marshalling_accuracy', name: 'دقة توجيه الطائرات', target: 99.9, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة عمليات توجيه الطائرات (Marshalling) التي تمت بدون أخطاء أو انحرافات.', dataSource: 'تقارير مراقبي الساحة, تدقيق السلامة', importance: 'معيار سلامة حاسم وفقًا لمتطلبات ISAGO لمنع الحوادث الأرضية.' }
    },
    marshalling_incidents_rate: {
        id: 'marshalling_incidents_rate', name: 'حوادث التوجيه لكل 1000 حركة', target: 0.5, unit: 'per_1000_mov', lowerIsBetter: true,
        tooltip: { description: 'عدد الحوادث المسجلة أثناء عمليات التوجيه أو الدفع للخلف لكل 1000 حركة طيران.', dataSource: 'تقارير السلامة', importance: 'مؤشر سلامة أساسي يهدف إلى تحقيق صفر حوادث.' }
    },
    mean_time_to_repair: {
        id: 'mean_time_to_repair', name: 'متوسط وقت الإصلاح (MTTR)', target: 240, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'متوسط الوقت بالدقائق المستغرق لإصلاح عطل في المعدات من وقت الإبلاغ عنه.', dataSource: 'CMMS', importance: 'يقيس سرعة وكفاءة فريق الصيانة.' }
    },
    no_show_rate: {
        id: 'no_show_rate', name: 'معدل عدم الصعود للطائرة (No-show)', target: 2, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'نسبة الركاب الذين أنهوا التسجيل ولم يصعدوا للطائرة.', dataSource: 'DCS', importance: 'يؤثر على دقة بيانات الركاب وقد يتطلب إخراج الأمتعة مما يسبب تأخيراً.' }
    },
    on_time_baggage_delivery_rate: {
        id: 'on_time_baggage_delivery_rate', name: 'معدل تسليم الحقائب في الوقت المحدد', target: 95, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للحقائب التي يتم تسليمها للركاب ضمن الإطار الزمني المحدد في اتفاقية مستوى الخدمة.', dataSource: 'نظام مناولة الأمتعة (BHS)', importance: 'مؤشر رئيسي لرضا الركاب وكفاءة عمليات الوصول.' }
    },
    on_time_checkin_completion: {
        id: 'on_time_checkin_completion', name: 'مؤشر إتمام التسجيل في الوقت المحدد', target: 95, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للرحلات التي تم فيها إكمال عمليات تسجيل جميع الركاب قبل الوقت النهائي المحدد.', dataSource: 'نظام التحكم في المغادرة (DCS)', importance: 'يضمن عدم وجود تأخير في مراحل ما قبل الصعود للطائرة ويحسن تجربة الركاب.' }
    },
    on_time_complaint_closure_rate: {
        id: 'on_time_complaint_closure_rate', name: 'معدل إغلاق شكاوى شركات الطيران في الوقت', target: 95, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للشكاوى الرسمية من شركات الطيران التي تم حلها وإغلاقها ضمن الإطار الزمني المحدد في اتفاقية مستوى الخدمة.', dataSource: 'نظام إدارة علاقات العملاء (CRM)', importance: 'يقيس كفاءة وفعالية قسم علاقات العملاء في حل المشكلات.' }
    },
    operational_incident_rate: {
        id: 'operational_incident_rate', name: 'معدل الحوادث التشغيلية', target: 1, unit: 'per_1000_mov', lowerIsBetter: true,
        tooltip: { description: 'عدد الحوادث التشغيلية (غير الضرر الأرضي) لكل 1000 عملية مناولة أو حركة طيران.', dataSource: 'تقارير السلامة, SMS', importance: 'يقيس سلامة العمليات اليومية بشكل عام.' }
    },
    otp: {
        id: 'otp', name: 'الأداء في الوقت المحدد (OTP)', target: 97, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للرحلات الجاهزة للإقلاع في الوقت المحدد حسب معايير IATA.', dataSource: 'نظام إدارة الرحلات (AIMS/FIDS)', importance: 'يعكس قدرة المدير على إدارة الموارد والوقت بفعالية، وهو متطلب أساسي في اتفاقيات SLA مع شركات الطيران.' },
        benchmark: { target: 98.5, source: 'IATA AHM' }
    },
    overtime_costs: {
        id: 'overtime_costs', name: 'تكلفة العمل الإضافي', target: 50000, unit: 'currency', lowerIsBetter: true,
        tooltip: { description: 'إجمالي تكاليف العمل الإضافي الشهرية بالريال السعودي.', dataSource: 'نظام الموارد البشرية (HRMS)', importance: 'قد يشير ارتفاعه إلى سوء تخطيط الموارد.' },
    },
    passenger_satisfaction_csat: {
        id: 'passenger_satisfaction_csat', name: 'معدل رضا المسافرين (CSAT)', target: 90, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النتيجة المئوية من استبيانات رضا المسافرين التي تقيس جودة الخدمة المقدمة.', dataSource: 'استبيانات الركاب، تطبيقات الطرف الثالث', importance: 'المقياس المباشر لجودة تجربة العميل.' }
    },
    passenger_satisfaction_score: {
        id: 'passenger_satisfaction_score', name: 'معدل رضا الركاب (نقاط)', target: 4.0, unit: 'score', lowerIsBetter: false,
        tooltip: { description: 'متوسط التقييم من استطلاعات رضا الركاب (على مقياس من 1 إلى 5 نقاط).', dataSource: 'استطلاعات رضا الركاب (ASQ)', importance: 'يقيس جودة الخدمة المقدمة للركاب بشكل مباشر.' }
    },
    preventive_maintenance_compliance: {
        id: 'preventive_maintenance_compliance', name: 'الالتزام بالصيانة الدورية', target: 100, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة مهام الصيانة الدورية المجدولة التي تم إنجازها في وقتها المحدد.', dataSource: 'نظام إدارة الصيانة (CMMS)', importance: 'يقلل من الأعطال المفاجئة ويزيد من عمر المعدات، وفقًا لمعايير IATA AHM 1110.' }
    },
    productivity_per_agent: {
        id: 'productivity_per_agent', name: 'معدل الإنتاجية لكل موظف', target: 25, unit: 'score', lowerIsBetter: false,
        tooltip: { description: 'متوسط عدد الركاب الذين يخدمهم الموظف الواحد في الساعة، مما يعكس كفاءة توزيع الموارد البشرية.', dataSource: 'RMS, DCS', importance: 'يساعد في تحسين تخطيط الموارد وتقليل التكاليف.' }
    },
    profitability_per_flight: {
        id: 'profitability_per_flight', name: 'الربحية لكل رحلة', target: 500, unit: 'currency', lowerIsBetter: false,
        tooltip: { description: 'صافي الربح المحقق من خدمة الرحلة الواحدة بعد خصم جميع التكاليف المباشرة وغير المباشرة.', dataSource: 'النظام المالي', importance: 'مؤشر أساسي للكفاءة المالية والاستدامة.' }
    },
    proactive_safety_reports: {
        id: 'proactive_safety_reports', name: 'الحوادث الوشيكة المبلغ عنها', target: 20, unit: 'incidents', lowerIsBetter: false,
        tooltip: { description: 'عدد الحوادث الوشيكة (Near Misses) التي يتم الإبلاغ عنها من قبل الموظفين شهريًا.', dataSource: 'نظام إدارة السلامة (SMS)', importance: 'يقيس وعي الموظفين بالسلامة ويشجع ثقافة الإبلاغ الاستباقي لمنع الحوادث.' }
    },
    prm_wait_time: {
        id: 'prm_wait_time', name: 'معدل وقت انتظار ذوي الاحتياجات الخاصة', target: 10, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'متوسط وقت انتظار المسافرين من ذوي الاحتياجات الخاصة للحصول على المساعدة المخصصة لهم.', dataSource: 'سجلات طلبات الخدمة، تتبع الموظفين', importance: 'مؤشر حيوي يعكس مستوى الخدمة الإنسانية والامتثال للوائح الدولية.' }
    },
    pushback_delay_rate: {
        id: 'pushback_delay_rate', name: 'معدل تأخير الدفع للخلف', target: 2, unit: 'percentage', lowerIsBetter: true,
        tooltip: { description: 'نسبة عمليات دفع الطائرة للخلف التي تأخرت عن الوقت المجدول.', dataSource: 'سجلات برج المراقبة, AIMS', importance: 'مؤشر مهم يؤثر على انسيابية حركة المطار وجزء من اتفاقيات SLA.' }
    },
    refueling_time: {
        id: 'refueling_time', name: 'وقت التزود بالوقود', target: 15, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'متوسط الوقت المستغرق لإنهاء عملية التزود بالوقود للطائرة.', dataSource: 'سجلات شركة الوقود', importance: 'مؤشر كفاءة يلتزم بمعايير IATA للتزويد بالوقود ويؤثر على وقت خدمة الطائرة.' }
    },
    request_response_time_airline: {
        id: 'request_response_time_airline', name: 'وقت الاستجابة لطلبات شركات الطيران', target: 240, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'متوسط الوقت المستغرق للاستجابة لطلبات أو استفسارات شركات الطيران.', dataSource: 'نظام CRM, سجلات البريد الإلكتروني', importance: 'مؤشر لجودة خدمة العملاء وسرعة دعمهم.' }
    },
    request_response_time_transport: {
        id: 'request_response_time_transport', name: 'وقت الاستجابة لطلبات النقل', target: 10, unit: 'minutes', lowerIsBetter: true,
        tooltip: { description: 'متوسط الوقت المستغرق من تلقي طلب النقل حتى وصول المركبة للموقع.', dataSource: 'نظام إدارة النقل', importance: 'يؤثر على كفاءة العمليات ورضا الطواقم والركاب.' }
    },
    resource_allocation_accuracy: {
        id: 'resource_allocation_accuracy', name: 'دقة توزيع الموارد', target: 90, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية لمدى تلبية توزيع الموارد (موظفين، معدات) لمتطلبات التشغيل الفعلية دون نقص أو فائض.', dataSource: 'نظام إدارة الموارد (RMS)، تقارير التخطيط', importance: 'يعكس كفاءة قسم التخطيط في استخدام الموارد المتاحة بالشكل الأمثل.' }
    },
    resource_utilization_efficiency: {
        id: 'resource_utilization_efficiency', name: 'كفاءة استخدام الموارد', target: 90, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية لساعات العمل الفعلية مقابل ساعات العمل المخطط لها.', dataSource: 'نظام الجدولة (RMS)', importance: 'يعكس كفاءة التخطيط والجدولة وتقليل الهدر في الموارد البشرية.' }
    },
    roster_efficiency: {
        id: 'roster_efficiency', name: 'كفاءة جداول المناوبات', target: 95, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'مدى تطابق جداول المناوبات مع متطلبات التشغيل الفعلية وتقليل الحاجة للتعديلات الطارئة.', dataSource: 'نظام الجدولة (RMS)', importance: 'يؤثر مباشرة على تكاليف العمل الإضافي واستقرار العمليات.' }
    },
    security_breach_incidents: {
        id: 'security_breach_incidents', name: 'حوادث الاختراق الأمني', target: 0, unit: 'incidents', lowerIsBetter: true,
        tooltip: { description: 'عدد حوادث الاختراق الأمني المسجلة في المناطق الخاضعة للمسؤولية.', dataSource: 'تقارير الأمن', importance: 'مؤشر حاسم لأمن وسلامة عمليات المطار.' }
    },
     security_compliance_rate: {
        id: 'security_compliance_rate', name: 'نسبة الالتزام بالإجراءات الأمنية', target: 100, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة الامتثال لإجراءات التحقق من وثائق السفر والفحص الأمني حسب معايير السلطات.', dataSource: 'تقارير التدقيق الأمني', importance: 'مؤشر سلامة وأمن غير قابل للتفاوض.' }
    },
    security_incident_rate: {
        id: 'security_incident_rate', name: 'معدل الحوادث الأمنية', target: 0, unit: 'per_1000_mov', lowerIsBetter: true,
        tooltip: { description: 'عدد الحوادث الأمنية المسجلة لكل 1000 حركة طيران.', dataSource: 'تقارير الأمن', importance: 'مؤشر أمن حاسم يهدف إلى صفر حوادث.' }
    },
    self_checkin_usage: {
        id: 'self_checkin_usage', name: 'معدل استخدام الخدمات الذاتية', target: 75, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة الركاب الذين يستخدمون أكشاك الخدمة الذاتية أو الإنترنت لإنهاء إجراءات السفر.', dataSource: 'تقارير DCS', importance: 'يعكس نجاح التحول الرقمي ويقلل الضغط على الكاونترات.' }
    },
    shift_coverage_compliance: {
        id: 'shift_coverage_compliance', name: 'نسبة الالتزام بتغطية المناوبات', target: 98, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للمناوبات المجدولة التي تم تغطيتها بالكامل بالموظفين المطلوبين دون نقص.', dataSource: 'نظام إدارة الموارد (RMS)', importance: 'يعكس دقة التخطيط والقدرة على تلبية متطلبات التشغيل اليومية.' }
    },
    sla_compliance: {
        id: 'sla_compliance', name: 'الامتثال لاتفاقيات مستوى الخدمة (SLA)', target: 99.5, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للالتزام ببنود عقود الخدمة الموقعة مع شركات الطيران.', dataSource: 'تقارير الأداء، نظام تتبع SLAs', importance: 'مقياس تعاقدي لجودة الخدمة ويؤثر على العلاقة مع العملاء.' }
    },
    spare_parts_availability: {
        id: 'spare_parts_availability', name: 'معدل توفر قطع الغيار الحرجة', target: 95, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة توفر قطع الغيار المصنفة كحرجة في المخزون عند طلبها.', dataSource: 'نظام إدارة المخزون', importance: 'يقلل من وقت توقف المعدات.' }
    },
    standards_compliance_rate: {
        id: 'standards_compliance_rate', name: 'معدل الامتثال للمعايير', target: 95, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة التدقيقات وعمليات الفحص التي تم اجتيازها بنجاح مقابل إجمالي التدقيقات.', dataSource: 'تقارير الجودة والتدقيق (ISAGO)', importance: 'يؤكد على الالتزام بمعايير السلامة والجودة العالمية.' }
    },
    training_completion: {
        id: 'training_completion', name: 'إكمال خطط التدريب الإلزامية', target: 100, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة الموظفين الذين أكملوا التدريب الإلزامي.', dataSource: 'نظام إدارة التعلم (LMS)', importance: 'يضمن أن الفريق يمتلك المهارات اللازمة.' }
    },
    turnaround_plan_compliance: {
        id: 'turnaround_plan_compliance', name: 'الالتزام بخطة خدمة الطائرة', target: 98, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'نسبة إنجاز جميع خطوات خدمة الطائرة في أوقاتها المحددة.', dataSource: 'نظام إدارة خدمة الطائرات (AACS)', importance: 'مقياس جودة تنفيذ العمليات وتنسيق الفريق.' }
    },
    waste_recycling_rate: {
        id: 'waste_recycling_rate', name: 'معدل إدارة النفايات (إعادة التدوير)', target: 60, unit: 'percentage', lowerIsBetter: false,
        tooltip: { description: 'النسبة المئوية للنفايات التي يتم إعادة تدويرها من إجمالي النفايات الناتجة عن العمليات.', dataSource: 'تقارير إدارة النفايات', importance: 'يعكس التزام الشركة بالمعايير البيئية والاستدامة (ISO 14001).' }
    },
};

// --- KPI CATEGORIZATION ---
// This new structure organizes KPIs into logical groups for easier management.
export const KPI_CATEGORIES: Record<string, string[]> = {
    'الكفاءة التشغيلية (ساحة وركاب)': ['otp', 'avg_turnaround_time', 'loading_accuracy', 'first_bag_delivery', 'last_bag_delivery', 'checkin_queue_time', 'boarding_gate_performance', 'checkin_time', 'boarding_time', 'turnaround_plan_compliance', 'aircraft_waiting_time', 'baggage_loading_time', 'pushback_delay_rate', 'marshalling_accuracy', 'refueling_time', 'fueling_accuracy', 'on_time_baggage_delivery_rate', 'ground_transport_availability', 'request_response_time_transport', 'handling_delay_rate', 'on_time_checkin_completion'],
    'تجربة العميل ورضاهم': ['baggage_accuracy', 'formal_complaints', 'sla_compliance', 'passenger_satisfaction_csat', 'prm_wait_time', 'no_show_rate', 'denied_boarding_rate', 'passenger_satisfaction_score', 'boarding_pass_accuracy'],
    'السلامة والجودة والأمن': ['accident_rate', 'audit_compliance', 'fod_incidents', 'proactive_safety_reports', 'corrective_action_closure_rate', 'security_breach_incidents', 'security_compliance_rate', 'baggage_damage_rate', 'marshalling_incidents_rate', 'fuel_spill_incidents', 'ground_damage_rate', 'standards_compliance_rate', 'incident_complaint_rate', 'security_incident_rate', 'injury_rate_osha', 'audit_item_compliance_rate', 'baggage_damage_rate_per_1000', 'operational_incident_rate', 'audit_findings_per_audit'],
    'إدارة المعدات والصيانة': ['gse_utilization', 'gse_availability', 'preventive_maintenance_compliance', 'mean_time_to_repair', 'first_time_fix_rate', 'spare_parts_availability', 'equipment_downtime'],
    'الأداء المالي': ['budget_adherence', 'overtime_costs', 'cost_per_turnaround', 'profitability_per_flight'],
    'إدارة الموارد البشرية والفريق': ['employee_turnover', 'training_completion', 'absenteeism_rate', 'roster_efficiency', 'productivity_per_agent', 'resource_utilization_efficiency'],
    'علاقات العملاء (شركات الطيران)': ['airline_satisfaction_score', 'contract_renewal_rate', 'request_response_time_airline', 'airline_complaint_index', 'airline_satisfaction_percent', 'on_time_complaint_closure_rate'],
    'الإدارة والتخطيط': ['forecasting_accuracy', 'resource_allocation_accuracy', 'shift_coverage_compliance'],
    'الاستدامة والبيئة': ['fuel_consumption_per_flight', 'waste_recycling_rate'],
    'التحول الرقمي والأتمتة': ['self_checkin_usage'],
};

export const RISK_KPI_IDS = new Set(KPI_CATEGORIES['السلامة والجودة والأمن']);


// Utility to add a default value and history to a KPI definition
const kpiWithValue = (kpiId: string, value: number): KPI => {
    const kpiMaster = deepCopy(ALL_KPIS[kpiId]);
    const history = generateHistory(value, kpiMaster.lowerIsBetter);
    // Use last generated history value as the current value
    const currentValue = history.length > 0 ? history[history.length - 1].value : value;
    return { ...kpiMaster, id: kpiId, value: currentValue, history };
};


// --- REVISED ROLE-BASED TEMPLATES ---

// Standardized Leadership Pillar - To be used across all roles
const LEADERSHIP_PILLAR: Pillar = {
    id: 'leadership_management',
    name: 'القيادة وإدارة الفريق',
    weight: 20,
    iconName: 'UserGroupIcon',
    kpis: [
        kpiWithValue('employee_turnover', 0.7),
        kpiWithValue('training_completion', 99),
        kpiWithValue('absenteeism_rate', 2.5)
    ]
};

// RAMP OPERATIONS Template
const RAMP_PILLARS: Pillar[] = [
  {
    id: 'operational_efficiency_ramp', name: 'الكفاءة التشغيلية للساحة', weight: 45, iconName: 'ChartBarIcon',
    kpis: [ kpiWithValue('otp', 98.5), kpiWithValue('avg_turnaround_time', 38), kpiWithValue('loading_accuracy', 99.9), kpiWithValue('turnaround_plan_compliance', 97) ],
  },
  {
    id: 'safety_security_ramp', name: 'السلامة والأمن في الساحة', weight: 25, iconName: 'ShieldCheckIcon',
    kpis: [ kpiWithValue('accident_rate', 0.5), kpiWithValue('fod_incidents', 0), kpiWithValue('ground_damage_rate', 0.2), kpiWithValue('marshalling_incidents_rate', 0.6) ],
  },
  {
    id: 'financial_performance_ramp', name: 'الأداء المالي للساحة', weight: 10, iconName: 'BanknotesIcon',
    kpis: [ kpiWithValue('cost_per_turnaround', 4500), kpiWithValue('overtime_costs', 65000) ],
  },
  { ...deepCopy(LEADERSHIP_PILLAR), weight: 20 },
];

// PASSENGER SERVICES Template
const PASSENGER_PILLARS: Pillar[] = [
  {
    id: 'customer_satisfaction_pax', name: 'رضا العملاء والركاب', weight: 40, iconName: 'HeartIcon',
    kpis: [ kpiWithValue('passenger_satisfaction_csat', 88), kpiWithValue('checkin_queue_time', 4), kpiWithValue('formal_complaints', 1), kpiWithValue('prm_wait_time', 12) ],
  },
  {
    id: 'operational_efficiency_pax', name: 'الكفاءة التشغيلية للخدمات', weight: 30, iconName: 'ChartBarIcon',
    kpis: [ kpiWithValue('first_bag_delivery', 14), kpiWithValue('last_bag_delivery', 28), kpiWithValue('boarding_gate_performance', 99), kpiWithValue('baggage_accuracy', 1.8), kpiWithValue('self_checkin_usage', 65)],
  },
   {
    id: 'financial_performance_pax', name: 'الأداء المالي للخدمات', weight: 10, iconName: 'BanknotesIcon',
    kpis: [ kpiWithValue('overtime_costs', 45000), kpiWithValue('sla_compliance', 99.8) ],
  },
  { ...deepCopy(LEADERSHIP_PILLAR), weight: 20 },
];

// TECHNICAL SERVICES Template
const TECHNICAL_PILLARS: Pillar[] = [
    {
        id: 'equipment_reliability', name: 'موثوقية المعدات', weight: 40, iconName: 'ArchiveBoxIcon',
        kpis: [ kpiWithValue('gse_availability', 98), kpiWithValue('mean_time_to_repair', 220), kpiWithValue('first_time_fix_rate', 92) ],
    },
    {
        id: 'maintenance_efficiency', name: 'كفاءة الصيانة', weight: 30, iconName: 'ChartBarIcon',
        kpis: [ kpiWithValue('preventive_maintenance_compliance', 98), kpiWithValue('spare_parts_availability', 95), kpiWithValue('equipment_downtime', 3) ],
    },
    {
        id: 'financial_performance_tech', name: 'الأداء المالي للفنيين', weight: 10, iconName: 'BanknotesIcon',
        kpis: [ kpiWithValue('budget_adherence', 100), kpiWithValue('overtime_costs', 40000) ],
    },
    { ...deepCopy(LEADERSHIP_PILLAR), weight: 20 },
];

// SAFETY & QUALITY Template
const SAFETY_PILLARS: Pillar[] = [
    {
        id: 'safety_quality_management', name: 'إدارة السلامة والجودة', weight: 45, iconName: 'ShieldCheckIcon',
        kpis: [ kpiWithValue('audit_compliance', 98), kpiWithValue('corrective_action_closure_rate', 95), kpiWithValue('proactive_safety_reports', 25), kpiWithValue('security_compliance_rate', 99) ],
    },
    {
        id: 'risk_management', name: 'إدارة المخاطر', weight: 35, iconName: 'ArchiveBoxIcon',
        kpis: [ kpiWithValue('accident_rate', 1), kpiWithValue('fod_incidents', 0), kpiWithValue('security_breach_incidents', 0), kpiWithValue('fuel_spill_incidents', 0) ],
    },
    { ...deepCopy(LEADERSHIP_PILLAR), weight: 20 },
];

// BUSINESS SUPPORT Template
const SUPPORT_PILLARS: Pillar[] = [
  {
    id: 'service_efficiency_support', name: 'كفاءة الخدمة والدعم', weight: 40, iconName: 'ChartBarIcon',
    kpis: [ kpiWithValue('sla_compliance', 99.8), kpiWithValue('roster_efficiency', 95), kpiWithValue('productivity_per_agent', 28) ],
  },
  {
    id: 'financial_performance_support', name: 'الأداء المالي للدعم', weight: 30, iconName: 'BanknotesIcon',
    kpis: [ kpiWithValue('budget_adherence', 98), kpiWithValue('overtime_costs', 30000) ],
  },
  { ...deepCopy(LEADERSHIP_PILLAR), weight: 30 },
];


export const ROLE_TEMPLATES: Record<ManagerRole, Pillar[]> = {
  RAMP: RAMP_PILLARS,
  PASSENGER: PASSENGER_PILLARS,
  SUPPORT: SUPPORT_PILLARS,
  SAFETY: SAFETY_PILLARS,
  TECHNICAL: TECHNICAL_PILLARS,
};

export const INITIAL_MANAGERS_DATA: Manager[] = [
  {
    id: 'manager_1',
    name: 'Abdullah H. Algarni',
    department: 'Baggage Sortation',
    role: 'PASSENGER',
    pillars: deepCopy(ROLE_TEMPLATES.PASSENGER),
    actionPlans: [],
  },
  {
    id: 'manager_2',
    name: 'Abdulaziz Mo. Alghamdi',
    department: 'Dispatch & Roster Partner',
    role: 'SUPPORT',
    pillars: deepCopy(ROLE_TEMPLATES.SUPPORT),
    actionPlans: [],
  },
  {
    id: 'manager_3',
    name: 'Rafat Al-Zamzamie',
    department: 'Hajj & Umrah Ramp',
    role: 'RAMP',
    pillars: deepCopy(ROLE_TEMPLATES.RAMP),
    actionPlans: [],
  },
  {
    id: 'manager_4',
    name: 'Abdulelah S.Olfat',
    department: 'Ramp Operations',
    role: 'RAMP',
    pillars: deepCopy(ROLE_TEMPLATES.RAMP),
    actionPlans: [],
  },
  {
    id: 'manager_5',
    name: 'Omar A. Alodaini',
    department: 'Passenger Services FAL',
    role: 'PASSENGER',
    pillars: deepCopy(ROLE_TEMPLATES.PASSENGER),
    actionPlans: [],
  },
  {
    id: 'manager_6',
    name: 'Raid Algadi',
    department: 'Passenger Services DOME',
    role: 'PASSENGER',
    pillars: deepCopy(ROLE_TEMPLATES.PASSENGER),
    actionPlans: [],
  },
  {
    id: 'manager_7',
    name: 'Saleh K. Aljehani',
    department: 'Passenger Services Local',
    role: 'PASSENGER',
    pillars: deepCopy(ROLE_TEMPLATES.PASSENGER),
    actionPlans: [],
  },
  {
    id: 'manager_8',
    name: 'Ali H. Alshumrani',
    department: 'Technical Services',
    role: 'TECHNICAL',
    pillars: deepCopy(ROLE_TEMPLATES.TECHNICAL),
    actionPlans: [],
  },
  {
    id: 'manager_9',
    name: 'Faisal A. Taweeli',
    department: 'Traffic Control Saudia',
    role: 'RAMP',
    pillars: deepCopy(ROLE_TEMPLATES.RAMP),
    actionPlans: [],
  },
  {
    id: 'manager_10',
    name: 'Loay F. Haneef',
    department: 'Admin & Business Support Services',
    role: 'SUPPORT',
    pillars: deepCopy(ROLE_TEMPLATES.SUPPORT),
    actionPlans: [],
  },
  {
    id: 'manager_11',
    name: 'Ahmed S. Nadershah',
    department: 'Airline Relations',
    role: 'SUPPORT',
    pillars: deepCopy(ROLE_TEMPLATES.SUPPORT),
    actionPlans: [],
  },
  {
    id: 'manager_12',
    name: 'Abdulmajeed A. Tlmesany',
    department: 'Baggage Services and Arrival',
    role: 'PASSENGER',
    pillars: deepCopy(ROLE_TEMPLATES.PASSENGER),
    actionPlans: [],
  },
  {
    id: 'manager_13',
    name: 'Saadi S. Alzahrani',
    department: 'Royal Fleet Services',
    role: 'RAMP',
    pillars: deepCopy(ROLE_TEMPLATES.RAMP),
    actionPlans: [],
  },
  {
    id: 'manager_15',
    name: 'Nazzal M. Alotibi',
    department: 'Hub Operations',
    role: 'RAMP',
    pillars: deepCopy(ROLE_TEMPLATES.RAMP),
    actionPlans: [],
  },
  {
    id: 'manager_16',
    name: 'Kholoud B. Babateen',
    department: 'Safety Quality and Security',
    role: 'SAFETY',
    pillars: deepCopy(ROLE_TEMPLATES.SAFETY),
    actionPlans: [],
  },
  {
    id: 'manager_17',
    name: 'Atif I. Alazhari',
    department: 'Passenger Services Hajj',
    role: 'PASSENGER',
    pillars: deepCopy(ROLE_TEMPLATES.PASSENGER),
    actionPlans: [],
  },
  {
    id: 'manager_18',
    name: 'Hani Almahmadi',
    department: 'Ramp Handling',
    role: 'RAMP',
    pillars: deepCopy(ROLE_TEMPLATES.RAMP),
    actionPlans: [],
  },
  {
    id: 'manager_19',
    name: 'Mohamed S. Binjahlan',
    department: 'G.S.E & U.L.D',
    role: 'TECHNICAL',
    pillars: deepCopy(ROLE_TEMPLATES.TECHNICAL),
    actionPlans: [],
  },
  {
    id: 'manager_20',
    name: 'Mohammed R. Aladamawi',
    department: 'Traffic Control FAL',
    role: 'RAMP',
    pillars: deepCopy(ROLE_TEMPLATES.RAMP),
    actionPlans: [],
  }
];

// --- MASTER LISTS FOR DYNAMIC EDITING ---
const allPillarTemplates = [...RAMP_PILLARS, ...PASSENGER_PILLARS, ...SUPPORT_PILLARS, ...SAFETY_PILLARS, ...TECHNICAL_PILLARS];
const uniquePillarsMap = new Map();
allPillarTemplates.forEach(p => {
    if (!uniquePillarsMap.has(p.id)) {
        // Create a version of the pillar with empty KPIs for adding, user can then add KPIs.
        const pillarShell = deepCopy(p);
        pillarShell.kpis = [];
        uniquePillarsMap.set(p.id, pillarShell);
    }
});
export const ALL_PILLARS_MASTER_LIST: Pillar[] = Array.from(uniquePillarsMap.values());


// This structure is deprecated in favor of KPI_CATEGORIES but kept for backward compatibility if needed.
export const PILLAR_KPI_MAP: Record<string, string[]> = {};


// Deprecated, use ROLE_TEMPLATES
export const PILLAR_TEMPLATE: Pillar[] = [];