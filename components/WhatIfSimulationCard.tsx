

import React, { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { LightBulbIcon, SparklesIcon, ArrowDownCircleIcon, ArrowUpCircleIcon, BanknotesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Spinner } from './Spinner.tsx';
import type { KPI, WhatIfAnalysis } from '../data.tsx';
import { generateWhatIfAnalysis, API_KEY_ERROR_MESSAGE, isAiAvailable } from '../services/geminiService.tsx';

type WhatIfSimulationCardProps = {
    managers: any[];
    stationOverallScore: number;
};

export const WhatIfSimulationCard = ({ managers, stationOverallScore }: WhatIfSimulationCardProps) => {
    const [selectedKpiId, setSelectedKpiId] = useState('');
    const [newValue, setNewValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<WhatIfAnalysis | null>(null);

    const allKpis = useMemo(() => {
        const kpiMap = new Map<string, KPI>();
        managers.forEach(manager => {
            manager.pillars.forEach(pillar => {
                pillar.kpis.forEach(kpi => {
                    if (!kpiMap.has(kpi.id)) {
                        kpiMap.set(kpi.id, kpi);
                    }
                });
            });
        });
        return Array.from(kpiMap.values()).sort((a,b) => a.name.localeCompare(b.name));
    }, [managers]);

    const selectedKpi = useMemo(() => allKpis.find(k => k.id === selectedKpiId), [allKpis, selectedKpiId]);

    const handleRunSimulation = async () => {
        if (!selectedKpi || newValue === '') {
            toast.error("يرجى اختيار مؤشر وإدخال قيمة جديدة للمحاكاة.");
            return;
        }
        
        setIsLoading(true);
        setAnalysisResult(null);
        const toastId = toast.loading('يقوم الذكاء الاصطناعي بتشغيل المحاكاة...');

        try {
            const result = await generateWhatIfAnalysis(selectedKpi, parseFloat(newValue), stationOverallScore);
            setAnalysisResult(result);
            toast.success("اكتملت المحاكاة بنجاح!", { id: toastId });
        } catch (e: any) {
            console.error(e);
            const errorMessage = e.message === API_KEY_ERROR_MESSAGE ? API_KEY_ERROR_MESSAGE : "فشلت المحاكاة. يرجى المحاولة مرة أخرى.";
            toast.error(errorMessage, { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
            <h3 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
                <LightBulbIcon className="h-6 w-6 text-cyan-400" />
                محاكاة "ماذا لو؟"
            </h3>
            <p className="text-sm text-slate-400 mb-4">
                اختر مؤشر أداء رئيسي، أدخل قيمة جديدة مقترحة، وشاهد كيف يمكن أن يؤثر هذا التغيير على الأداء العام للمحطة والمؤشرات الأخرى ذات الصلة.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-6">
                <div className="md:col-span-1">
                    <label htmlFor="kpi-select" className="block text-sm font-medium text-slate-400 mb-1">اختر المؤشر</label>
                    <select
                        id="kpi-select"
                        value={selectedKpiId}
                        onChange={(e) => setSelectedKpiId(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                        <option value="">-- اختر مؤشر --</option>
                        {allKpis.map(kpi => (
                            <option key={kpi.id} value={kpi.id}>{kpi.name}</option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-1">
                    <label htmlFor="new-value" className="block text-sm font-medium text-slate-400 mb-1">القيمة الجديدة المقترحة</label>
                    <input
                        id="new-value"
                        type="number"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder={selectedKpi ? `الحالي: ${selectedKpi.value}` : 'أدخل القيمة'}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                </div>
                <div className="md:col-span-1">
                    <button
                        onClick={handleRunSimulation}
                        disabled={isLoading || !selectedKpiId || newValue === '' || !isAiAvailable}
                        title={!isAiAvailable ? API_KEY_ERROR_MESSAGE : "تشغيل المحاكاة"}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        <SparklesIcon className="h-5 w-5" />
                        <span>تشغيل المحاكاة</span>
                    </button>
                </div>
            </div>

            {isLoading && (
                <div className="flex justify-center items-center gap-2 p-4">
                    <Spinner className="h-5 w-5" />
                    <span>جاري تشغيل المحاكاة...</span>
                </div>
            )}

            {analysisResult && (
                <div className="mt-6 border-t border-slate-700 pt-6 space-y-6 animate-fade-in-up">
                    <div className="bg-slate-900/50 p-4 rounded-lg border-l-4 border-cyan-500">
                        <h4 className="font-bold text-cyan-400 mb-2">ملخص المحاكاة</h4>
                        <p>{analysisResult.simulation_summary}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 text-center">
                            <h4 className="font-semibold text-slate-400 mb-2 flex items-center justify-center gap-2"><BanknotesIcon className="h-5 w-5"/>التأثير على الأداء العام للمحطة</h4>
                            <div className="flex items-center justify-center gap-4">
                                <span className="text-2xl font-bold text-slate-500 line-through">{analysisResult.overall_score_impact.from}%</span>
                                <ArrowPathIcon className="h-6 w-6 text-cyan-400"/>
                                <span className="text-4xl font-bold text-green-400">{analysisResult.overall_score_impact.to}%</span>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                             <h4 className="font-semibold text-slate-400 mb-3 flex items-center gap-2">التأثيرات المتسلسلة</h4>
                             <ul className="space-y-2 text-sm">
                                {analysisResult.related_kpis_impact.map((impact, index) => (
                                    <li key={index} className="flex items-start gap-2">
                                        {impact.impact_description.includes('يتحسن') || impact.impact_description.includes('تحسن') ? 
                                            <ArrowUpCircleIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0"/> :
                                            <ArrowDownCircleIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0"/>
                                        }
                                        <div>
                                            <span className="font-bold">{impact.kpi_name}:</span> {impact.impact_description}
                                        </div>
                                    </li>
                                ))}
                             </ul>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                         <h4 className="font-semibold text-slate-400 mb-3 flex items-center gap-2">التوصيات</h4>
                         <ul className="space-y-2 text-sm list-disc pl-5">
                            {analysisResult.recommendations.map((rec, index) => (
                                <li key={index}>{rec}</li>
                            ))}
                         </ul>
                    </div>
                </div>
            )}
        </div>
    );
};