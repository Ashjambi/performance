

import React, { useState, useEffect, useContext } from 'react';
import { XMarkIcon, PlusCircleIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import type { KPI, Manager } from '../data.tsx';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.tsx';
import { Spinner } from './Spinner.tsx';
import { generateRootCauseAnalysis, generateActionPlanSteps, API_KEY_ERROR_MESSAGE } from '../services/geminiService.tsx';
import type { RootCauseAnalysis } from '../services/geminiService.tsx';

type RootCauseAnalysisModalProps = {
  isOpen: boolean;
  onClose: () => void;
  kpi: KPI;
};

export const RootCauseAnalysisModal = ({ isOpen, onClose, kpi }: RootCauseAnalysisModalProps) => {
  const { managers, selectedManagerId } = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);

  const [analysis, setAnalysis] = useState<RootCauseAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingPlanFor, setGeneratingPlanFor] = useState<string | null>(null);
  
  const selectedManager = managers.find(m => m.id === selectedManagerId);

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!isOpen || !kpi || !selectedManager) return;

      setIsLoading(true);
      setError(null);
      setAnalysis(null);

      try {
        const result = await generateRootCauseAnalysis(kpi, selectedManager);
        setAnalysis(result);
      } catch (e: any) {
        console.error(e);
        const errorMessage = e.message === API_KEY_ERROR_MESSAGE ? API_KEY_ERROR_MESSAGE : "حدث خطأ أثناء تحليل السبب الجذري. يرجى المحاولة مرة أخرى.";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalysis();
  }, [isOpen, kpi, selectedManager]);
  
  const handleGeneratePlan = async (reason: string) => {
      if (!selectedManagerId) return;
      
      const recommendationText = `معالجة "${reason}" لتحسين مؤشر "${kpi.name}"`;

      setGeneratingPlanFor(reason);
      const toastId = toast.loading('يقوم الذكاء الاصطناعي بإنشاء خطة عمل...');
      
      try {
          const { steps } = await generateActionPlanSteps(recommendationText);
          dispatch({ 
              type: 'ADD_ACTION_PLAN', 
              payload: { 
                  managerId: selectedManagerId, 
                  recommendation: recommendationText, 
                  steps
              }
          });
          toast.success('تم إنشاء خطة العمل بنجاح!', { id: toastId });
          onClose(); // Close modal after success
      } catch (e: any) {
          console.error(e);
          const errorMessage = e.message === API_KEY_ERROR_MESSAGE ? API_KEY_ERROR_MESSAGE : 'فشل إنشاء خطة العمل.';
          toast.error(errorMessage, { id: toastId });
      } finally {
          setGeneratingPlanFor(null);
      }
  }


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DocumentMagnifyingGlassIcon className="h-6 w-6 text-cyan-400" />
            تحليل السبب الجذري
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
        </header>

        <div className="p-6 overflow-y-auto text-slate-300">
          <p className="text-slate-400 mb-4">
            تحليل الأسباب المحتملة التي أدت إلى انخفاض أداء مؤشر: <span className="font-bold text-cyan-400">{kpi.name}</span>
          </p>

          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Spinner className="" />
              <p>يقوم الذكاء الاصطناعي بتشخيص المشكلة...</p>
            </div>
          )}
          {error && (
            <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg">
              <h3 className="font-bold mb-2">حدث خطأ</h3>
              <p>{error}</p>
            </div>
          )}
          {analysis && (
            <div className="space-y-3 animate-fade-in">
              {analysis.causes.map((category) => (
                <details key={category.category} className="bg-slate-900/50 rounded-lg border border-slate-700 transition-all open:border-cyan-500/50" open>
                    <summary className="font-bold text-lg text-slate-100 cursor-pointer p-3 flex justify-between items-center">
                        {category.category}
                        <ChevronDownIcon className="h-5 w-5 text-slate-400 transition-transform details-arrow" />
                    </summary>
                    <div className="px-3 pb-3">
                        <ul className="space-y-2">
                            {category.reasons.map((reason, index) => (
                                <li key={index} className="bg-slate-800 p-3 rounded-md border border-slate-700 flex justify-between items-center gap-3">
                                    <p className="flex-grow">{reason}</p>
                                    <button 
                                        onClick={() => handleGeneratePlan(reason)}
                                        disabled={generatingPlanFor === reason}
                                        className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-semibold disabled:opacity-50 disabled:cursor-wait flex-shrink-0"
                                    >
                                        {generatingPlanFor === reason ? (
                                            <>
                                                <Spinner className="h-4 w-4" />
                                                <span>جاري الإنشاء...</span>
                                            </>
                                        ) : (
                                            <>
                                                <PlusCircleIcon className="h-5 w-5" />
                                                <span>إنشاء خطة</span>
                                            </>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </details>
              ))}
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-slate-700 text-end flex-shrink-0">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg">
            إغلاق
          </button>
        </footer>
      </div>
      <style>{`
        @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-in-out forwards; }
        details .details-arrow { transition: transform 0.2s; }
        details[open] .details-arrow { transform: rotate(180deg); }
      `}</style>
    </div>
  );
};