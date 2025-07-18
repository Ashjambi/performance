


import React, { useState, useEffect, useMemo, useContext } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { CpuChipIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { toast } from 'react-hot-toast';
import type { KPI, AnalysisResult } from '../data.tsx';
import { forecastKpiValue } from '../data.tsx';
import { Spinner } from './Spinner.tsx';
import { generateForecastAnalysis, API_KEY_ERROR_MESSAGE } from '../services/geminiService.tsx';
import { AppStateContext } from '../context/AppContext.tsx';

type ForecastModalProps = {
  isOpen: boolean;
  onClose: () => void;
  kpi: KPI;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm p-3 border border-slate-700 rounded-lg shadow-xl">
        <p className="label text-slate-300 font-semibold">{`${label}`}</p>
        {payload[0] && payload[0].value !== null && <p className="intro text-cyan-400">{`الأداء : ${payload[0].value}`}</p>}
        {payload[1] && payload[1].value !== null && <p className="intro text-yellow-400">{`المتوقع : ${payload[1].value}`}</p>}
      </div>
    );
  }
  return null;
};

export const ForecastModal = ({ isOpen, onClose, kpi }: ForecastModalProps) => {
  const { selectedManagerId } = useContext(AppStateContext);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const forecastData = useMemo(() => {
    if (!kpi) return { chartData: [], forecastedValue: null };
    
    const forecastedValue = forecastKpiValue(kpi);

    const historyData = (kpi.history || [])
        .slice(-6)
        .map(h => ({
            date: new Date(h.date).toLocaleString('ar-EG', { month: 'short', year: 'numeric' }),
            value: h.value,
            forecast: null,
        }));
    
    if (forecastedValue !== null && historyData.length > 0) {
      const lastHistoryPoint = historyData[historyData.length - 1];
      const chartData = [
          ...historyData,
          { date: 'المستقبل', value: null, forecast: forecastedValue }
      ];
       // To make the dashed line connect, we need the last real point in the forecast series
      if (chartData.length >= 2) {
        chartData[chartData.length - 2].forecast = lastHistoryPoint.value;
      }

      return { chartData, forecastedValue };
    }

    return { chartData: historyData, forecastedValue: null };

  }, [kpi]);

  const { chartData, forecastedValue } = forecastData;

  const handleGenerateAnalysis = async () => {
    if (forecastedValue === null || !selectedManagerId) return;
    setIsLoading(true);
    setAnalysisResult(null);
    try {
      const result = await generateForecastAnalysis(kpi, selectedManagerId, forecastedValue);
      setAnalysisResult(result);
      toast.success("تم إنشاء تحليل التوقعات بنجاح");
    } catch(e: any) {
      console.error(e);
      const errorMessage = e.message === API_KEY_ERROR_MESSAGE ? API_KEY_ERROR_MESSAGE : "فشل إنشاء تحليل التوقعات.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setAnalysisResult(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col scale-95 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CpuChipIcon className="h-6 w-6 text-cyan-400" />
            التنبؤ المستقبلي: {kpi.name}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
        </header>

        <div className="p-6 overflow-y-auto text-slate-300">
            {chartData.length >= 2 ? (
            <>
                <div className="h-72 w-full mb-6">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                            <YAxis stroke="#94a3b8" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']}/>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{fontSize: '14px'}}/>
                            <Line type="monotone" dataKey="value" name="الأداء الفعلي" stroke="#38bdf8" strokeWidth={2} activeDot={{ r: 8 }} connectNulls={false} />
                            <Line type="monotone" dataKey="forecast" name="الأداء المتوقع" stroke="#facc15" strokeWidth={2} strokeDasharray="5 5" activeDot={{ r: 8 }} connectNulls={true} />
                            <ReferenceLine y={kpi.target} label={{ value: "الهدف", position: "insideTopLeft", fill: "#f87171", fontSize: 12 }} stroke="#f87171" strokeDasharray="4 4" />
                            {kpi.benchmark && (
                                <ReferenceLine y={kpi.benchmark.target} label={{ value: `المرجع (${kpi.benchmark.source})`, position: "insideTopRight", fill: "#a78bfa", fontSize: 12 }} stroke="#a78bfa" strokeDasharray="4 4" />
                            )}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
                    <div className="bg-slate-900 p-3 rounded-lg"><span className="block text-slate-400 text-sm">القيمة الحالية</span><span className="text-2xl font-bold text-white">{kpi.value}</span></div>
                    <div className="bg-slate-900 p-3 rounded-lg"><span className="block text-slate-400 text-sm">الهدف</span><span className="text-2xl font-bold text-red-400">{kpi.target}</span></div>
                    <div className="bg-slate-900 p-3 rounded-lg"><span className="block text-slate-400 text-sm">المتوقع الشهر القادم</span><span className="text-2xl font-bold text-yellow-400">{forecastedValue !== null ? forecastedValue : 'N/A'}</span></div>
                </div>

                <div className="space-y-4">
                    <button 
                    onClick={handleGenerateAnalysis}
                    disabled={isLoading || forecastedValue === null}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Spinner className="h-5 w-5"/> : <SparklesIcon className="h-5 w-5" />}
                        {isLoading ? "جاري التحليل..." : "تحليل التنبؤ وطلب النصيحة"}
                    </button>

                    {analysisResult && (
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 animate-fade-in">
                            <h4 className="font-bold text-cyan-400 mb-2">ملخص التحليل:</h4>
                            <p className="text-slate-300 mb-4 whitespace-pre-wrap">{analysisResult.analysis}</p>
                            <h4 className="font-bold text-cyan-400 mb-2">أفضل الممارسات للتحسين:</h4>
                            <ul className="list-disc ps-5 space-y-2">
                                {analysisResult.recommendations.map((rec, index) => <li key={index}>{rec.text}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            </>
            ) : (
                <div className="text-center py-10 text-slate-500">
                    <p>لا تتوفر بيانات تاريخية كافية للتنبؤ.</p>
                </div>
            )}
        </div>

        <footer className="p-4 border-t border-slate-700 text-end flex-shrink-0">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">إغلاق</button>
        </footer>
      </div>
      <style>{`
        @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
};