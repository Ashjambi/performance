


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
            تحليل الاتجاه التاريخي: