
import React, { useState, useMemo, useContext } from 'react';
import { toast } from 'react-hot-toast';
import { LightBulbIcon, SparklesIcon, ArrowDownCircleIcon, ArrowUpCircleIcon, BanknotesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Spinner } from './Spinner.tsx';
import { AppStateContext } from '../context/AppContext.tsx';
import type { KPI, WhatIfAnalysis } from '../data.tsx';
import { generateWhatIfAnalysis } from '../services/geminiService.tsx';

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
        } catch (e) {
            console.error(e);
            toast.error("فشلت المحاكاة. يرجى المحاولة مرة أخرى.", { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleReset = () => {
        setAnalysisResult(null);
        setSelectedKpiId('');
        setNewValue('');
    };

    return (
        <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
            <div className="flex items-center mb-4">
                <div className="p-2 bg-slate-700 rounded-md me-3"><LightBulbIcon className="h-6 w-6 text-cyan-400" /></div>
                <h3 className="text-xl font-bold text-slate-100">محاكي الأداء المستقبلي (ماذا لو؟)</h3>
            </div>

            {!analysisResult ? (
                 <>
                    <p className="text-slate-400 mb-4 text-sm">اختر مؤشرًا رئيسيًا واقترح تحسينًا جديدًا عليه، وسيقوم الذكاء الاصطناعي بتحليل التأثيرات المتوقعة على الأداء العام والمؤشرات الأخرى.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="kpi-select" className="block text-sm font-medium text-slate-400 mb-1">1. اختر المؤشر</label>
                                <select 
                                    id="kpi-select"
                                    value={selectedKpiId}
                                    onChange={e => setSelectedKpiId(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="" disabled>اختر مؤشر أداء رئيسي...</option>
                                    {allKpis.map(kpi => <option key={kpi.id} value={kpi.id}>{kpi.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="new-value" className="block text-sm font-medium text-slate-400 mb-1">2. أدخل القيمة الجديدة</label>
                                <input 
                                    type="number" 
                                    id="new-value"
                                    value={newValue}
                                    onChange={e => setNewValue(e.target.value)}
                                    placeholder={selectedKpi ? `القيمة الحالية: ${selectedKpi.value}` : "أدخل قيمة..."}
                                    disabled={!selectedKpiId}
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleRunSimulation}
                            disabled={isLoading || !selectedKpiId || newValue === ''}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Spinner className="h-5 w-5" /> : <SparklesIcon className="h-5 w-5" />}
                            {isLoading ? 'جاري التحليل...' : 'تشغيل المحاكاة'}
                        </button>
                    </div>
                </>
            ) : (
                 <div className="space-y-6 animate-fade-in">
                     <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                        <h4 className="font-bold text-cyan-400 mb-2">ملخص المحاكاة</h4>
                        <p>{analysisResult.simulation_summary}</p>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 text-center">
                            <h5 className="text-slate-400 text-sm font-semibold flex items-center justify-center gap-2"><ArrowUpCircleIcon className="h-5 w-5"/>الأداء العام</h5>
                            <p className="text-2xl font-bold text-green-400 mt-2">
                                {analysisResult.overall_score_impact.from}% &rarr; {analysisResult.overall_score_impact.to}%
                            </p>
                        </div>
                         <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                             <h5 className="text-slate-400 text-sm font-semibold mb-2 flex items-center gap-2"><ArrowDownCircleIcon className="h-5 w-5"/>التأثيرات المتسلسلة</h5>
                             <ul className="text-xs space-y-1 text-slate-300">
                                {analysisResult.related_kpis_impact.map((item, i) => <li key={i}>&bull; {item.impact_description}</li>)}
                             </ul>
                        </div>
                    </div>
                     <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                        <h4 className="font-bold text-cyan-400 mb-2">توصيات استراتيجية</h4>
                        <ul className="list-disc ps-5 space-y-1">
                            {analysisResult.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                        </ul>
                     </div>

                    <button
                        onClick={handleReset}
                        className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300"
                    >
                        <ArrowPathIcon className="h-5 w-5" />
                        إجراء محاكاة جديدة
                    </button>
                 </div>
            )}
            
            <style>{`
                 @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};
