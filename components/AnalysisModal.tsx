



import React, { useState } from 'react';
import { XMarkIcon, PlusCircleIcon } from '@heroicons/react/24/solid';
import type { AnalysisResult, Recommendation } from '../data.tsx';
import { ROLES } from '../data.tsx';
import { Spinner } from './Spinner.tsx';

type AnalysisModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  analysisResult: AnalysisResult | null;
  error: string | null;
  title: string;
  onGeneratePlan?: (recommendation: Recommendation) => void;
};

export const AnalysisModal = ({
  isOpen,
  onClose,
  isLoading,
  analysisResult,
  error,
  title,
  onGeneratePlan,
}: AnalysisModalProps) => {
  if (!isOpen) return null;
  
  const [generatingPlanFor, setGeneratingPlanFor] = useState<string | null>(null);

  const handlePlanGeneration = async (rec: Recommendation) => {
      if (!onGeneratePlan) return;
      setGeneratingPlanFor(rec.text);
      await onGeneratePlan(rec);
      setGeneratingPlanFor(null);
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col transition-transform duration-300 scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="إغلاق"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto text-slate-300">
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Spinner className="" />
              <p>يقوم الذكاء الاصطناعي بتحليل البيانات...</p>
            </div>
          )}
          {error && (
            <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg">
              <h3 className="font-bold mb-2">حدث خطأ</h3>
              <p>{error}</p>
            </div>
          )}
          {analysisResult && !isLoading && !error && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-2 border-b-2 border-cyan-400/30 pb-1">
                  ملخص التحليل
                </h3>
                <p className="whitespace-pre-wrap leading-relaxed">{analysisResult.analysis}</p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-2 border-b-2 border-cyan-400/30 pb-1">
                  التوصيات
                </h3>
                <ul className="space-y-3">
                  {analysisResult.recommendations.map((rec, index) => (
                    <li key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-start gap-3 mb-3">
                            <p className="leading-relaxed flex-grow">{rec.text}</p>
                            {rec.targetRole && (
                                <span className="flex-shrink-0 text-xs bg-cyan-900 text-cyan-300 px-2 py-1 rounded-full whitespace-nowrap font-semibold">
                                    قسم: {ROLES[rec.targetRole]}
                                </span>
                            )}
                        </div>
                        {onGeneratePlan && (
                             <button
                                onClick={() => handlePlanGeneration(rec)}
                                disabled={generatingPlanFor === rec.text}
                                className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-semibold disabled:opacity-50 disabled:cursor-wait"
                            >
                                {generatingPlanFor === rec.text ? (
                                    <>
                                        <Spinner className="h-4 w-4" />
                                        <span>جاري إنشاء الخطة...</span>
                                    </>
                                ) : (
                                    <>
                                        <PlusCircleIcon className="h-5 w-5" />
                                        <span>إنشاء خطة عمل</span>
                                    </>
                                )}
                            </button>
                        )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
        <footer className="p-4 border-t border-slate-700 text-end flex-shrink-0">
             <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                إغلاق
            </button>
        </footer>
      </div>
    </div>
  );
};