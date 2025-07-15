
import React, { useState } from 'react';
import { XMarkIcon, UserGroupIcon, PlusCircleIcon } from '@heroicons/react/24/solid';
import { DocumentMagnifyingGlassIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import type { PillarDiagnosisResult } from '../services/geminiService.js';
import type { Recommendation } from '../data.js';
import { ROLES } from '../data.js';
import { Spinner } from './Spinner.js';

type PillarDiagnosisModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  result: PillarDiagnosisResult | null;
  pillarName: string;
  onGeneratePlan: (recommendation: Recommendation) => void;
};

export const PillarDiagnosisModal = ({
  isOpen,
  onClose,
  isLoading,
  result,
  pillarName,
  onGeneratePlan,
}: PillarDiagnosisModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DocumentMagnifyingGlassIcon className="h-6 w-6 text-cyan-400" />
            تشخيص ركيزة: {pillarName}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="إغلاق"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto text-slate-300">
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Spinner className="" />
              <p>يقوم الذكاء الاصطناعي بتشخيص الأداء...</p>
            </div>
          )}
          {result && !isLoading && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-2 border-b-2 border-cyan-400/30 pb-1">
                  ملخص التحليل
                </h3>
                <p className="whitespace-pre-wrap leading-relaxed">{result.analysis}</p>
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
                    <UserGroupIcon className="h-5 w-5"/>
                    مدراء يتطلبون الانتباه
                </h3>
                <div className="space-y-2">
                  {result.contributing_managers.map((manager, index) => (
                    <div key={index} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                        <p className="font-bold text-slate-100">{manager.manager_name}</p>
                        <p className="text-sm text-slate-400 mt-1">{manager.reasoning}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-cyan-400 mb-2 flex items-center gap-2">
                    <LightBulbIcon className="h-5 w-5"/>
                    توصيات للتحسين
                </h3>
                <ul className="space-y-3">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-start gap-3 mb-3">
                            <p className="leading-relaxed flex-grow">{rec.text}</p>
                            <span className="flex-shrink-0 text-xs bg-cyan-900 text-cyan-300 px-2 py-1 rounded-full font-semibold">
                                قسم: {ROLES[rec.targetRole]}
                            </span>
                        </div>
                        <button
                            onClick={() => onGeneratePlan(rec)}
                            className="inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-semibold"
                        >
                            <PlusCircleIcon className="h-5 w-5" />
                            <span>إنشاء خطة عمل</span>
                        </button>
                    </li>
                  ))}
                </ul>
              </div>
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
        @keyframes scale-in {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }

        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-in-out forwards; }
      `}</style>
    </div>
  );
};