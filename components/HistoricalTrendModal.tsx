

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { ArrowTrendingUpIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { toast } from 'react-hot-toast';
import type { KPI, KPIHistory } from '../data.tsx';
import { calculatePeerAverageForKpi } from '../data.tsx';
import { AppStateContext } from '../context/AppContext.tsx';
import { Spinner } from './Spinner.tsx';
import { generateTrendAnalysis } from '../services/geminiService.tsx';

type HistoricalTrendModalProps = {
  isOpen: boolean;
  onClose: () => void;
  kpi: KPI;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm p-3 border border-slate-700 rounded-lg shadow-xl">
        <p className="label text-slate-300 font-semibold">{`${label}`}</p>
        <p className="intro text-cyan-400">{`الأداء : ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

export const HistoricalTrendModal = ({ isOpen, onClose, kpi }: HistoricalTrendModalProps) => {
  const { managers, selectedManagerId } = useContext(AppStateContext);
  
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<{ analysis: string, suggestion: string } | null>(null);

  const historyData = useMemo(() => {
    return (kpi?.history || [])
        .slice(-6) // get last 6 months
        .map(h => ({
            ...h,
            date: new Date(h.date).toLocaleString('ar-EG', { month: 'short', year: 'numeric' })
        }));
  }, [kpi]);

  const peerAverage = useMemo(() => {
    if (!kpi || !selectedManagerId) return null;
    return calculatePeerAverageForKpi(managers, selectedManagerId, kpi.id);
  }, [managers, selectedManagerId, kpi]);

  const handleGenerateAnalysis = async () => {
    if (!selectedManagerId) return;
    setIsLoading(true);
    setAnalysis(null);
    try {
      const result = await generateTrendAnalysis(kpi, selectedManagerId);
      setAnalysis(result);
      toast.success("تم إنشاء تحليل الاتجاه بنجاح");
    } catch(e) {
      console.error(e);
      toast.error("فشل إنشاء تحليل الاتجاه.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Reset state when modal opens
    if (isOpen) {
      setAnalysis(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col scale-95 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowTrendingUpIcon className="h-6 w-6 text-cyan-400" />
            تحليل الاتجاه التاريخي: {kpi.name}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
        </header>

        <div className="p-6 overflow-y-auto text-slate-300">
            <div className="h-72 w-full mb-6">
                 <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData} margin={{ top: 5, right: 80, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} domain={['dataMin - 1', 'dataMax + 1']}/>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{fontSize: '14px'}}/>
                        <Line type="monotone" dataKey="value" name="الأداء الفعلي" stroke="#38bdf8" strokeWidth={2} activeDot={{ r: 8 }} />
                        <ReferenceLine y={kpi.target} label={{ value: "الهدف", position: "left", fill: "#f87171", fontSize: 12 }} stroke="#f87171" strokeDasharray="4 4" />
                        {peerAverage !== null && (
                             <ReferenceLine y={peerAverage} label={{ value: "متوسط النظراء", position: "right", fill: "#4ade80", fontSize: 12 }} stroke="#4ade80" strokeDasharray="4 4" />
                        )}
                         {kpi.benchmark && (
                            <ReferenceLine y={kpi.benchmark.target} label={{ value: `المرجع (${kpi.benchmark.source})`, position: "right", fill: "#a78bfa", fontSize: 12, dy: 15 }} stroke="#a78bfa" strokeDasharray="4 4" />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            <div className="space-y-4">
                <button 
                  onClick={handleGenerateAnalysis}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Spinner className="h-5 w-5"/> : <SparklesIcon className="h-5 w-5" />}
                    {isLoading ? "جاري التحليل..." : "تحليل الاتجاه بالذكاء الاصطناعي"}
                </button>

                {analysis && (
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 animate-fade-in">
                        <h4 className="font-bold text-cyan-400 mb-2">ملخص التحليل:</h4>
                        <p className="text-slate-300 mb-3">{analysis.analysis}</p>
                        <h4 className="font-bold text-cyan-400 mb-2">اقتراح للتحسين:</h4>
                        <p className="text-slate-300">{analysis.suggestion}</p>
                    </div>
                )}
            </div>

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