

import React, { useState, useEffect } from 'react';
import { XMarkIcon, PrinterIcon, AcademicCapIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import type { KPI, TrainingScenario } from '../data.tsx';
import { Spinner } from './Spinner.tsx';
import { generateTrainingScenario, API_KEY_ERROR_MESSAGE } from '../services/geminiService.tsx';

type TrainingScenarioModalProps = {
  isOpen: boolean;
  onClose: () => void;
  kpi: KPI;
};

export const TrainingScenarioModal = ({ isOpen, onClose, kpi }: TrainingScenarioModalProps) => {
  const [scenario, setScenario] = useState<TrainingScenario | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number | null }>({});

  useEffect(() => {
    const fetchScenario = async () => {
      if (!isOpen || !kpi) return;

      // Reset state on open
      setIsLoading(true);
      setError(null);
      setScenario(null);
      setSelectedAnswers({});

      try {
        const result = await generateTrainingScenario(kpi);
        setScenario(result);
      } catch (e: any) {
        console.error("Failed to generate training scenario:", e);
        const errorMessage = e.message === API_KEY_ERROR_MESSAGE ? API_KEY_ERROR_MESSAGE : "حدث خطأ أثناء إنشاء السيناريو. يرجى المحاولة مرة أخرى.";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScenario();
  }, [isOpen, kpi]);
  
  const handlePrint = () => {
      const printContents = document.getElementById('printable-scenario')?.innerHTML;
      const originalContents = document.body.innerHTML;
      if (printContents) {
          document.body.innerHTML = `
            <html>
              <head>
                <title>طباعة سيناريو تدريبي</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                <style>
                  body { 
                    font-family: 'Cairo', sans-serif; 
                    direction: rtl;
                    margin: 20px;
                  }
                  .section-title { 
                    font-size: 1.25rem; 
                    font-weight: bold; 
                    color: #0891b2; /* cyan-600 */
                    border-bottom: 2px solid #0e7490; 
                    padding-bottom: 5px; 
                    margin-bottom: 15px; 
                  }
                  .step-card { 
                    border: 1px solid #e5e7eb; 
                    border-radius: 8px; 
                    padding: 15px; 
                    margin-bottom: 15px;
                    background-color: #f9fafb; 
                  }
                  .feedback {
                      padding: 10px;
                      margin-top: 10px;
                      border-radius: 6px;
                  }
                  .feedback.correct {
                      background-color: #d1fae5;
                      border: 1px solid #6ee7b7;
                  }
                   .feedback.incorrect {
                      background-color: #fee2e2;
                      border: 1px solid #fca5a5;
                  }
                </style>
              </head>
              <body>
                ${printContents}
              </body>
            </html>
          `;
          window.print();
          document.body.innerHTML = originalContents;
          window.location.reload(); // To restore scripts and event listeners
      }
  };

  const handleSelectOption = (stepIndex: number, optionIndex: number) => {
    setSelectedAnswers(prev => ({ ...prev, [stepIndex]: optionIndex }));
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <AcademicCapIcon className="h-6 w-6 text-cyan-400" />
            سيناريو تدريبي لـ: {kpi.name}
          </h2>
          <div>
            <button onClick={handlePrint} className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors me-2" aria-label="طباعة"><PrinterIcon className="h-5 w-5" /></button>
            <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
          </div>
        </header>

        <div className="p-6 overflow-y-auto text-slate-300">
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Spinner className="" />
              <p>يقوم الذكاء الاصطناعي بإعداد سيناريو تدريبي...</p>
            </div>
          )}
          {error && (
            <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg">
              <h3 className="font-bold mb-2">حدث خطأ</h3>
              <p>{error}</p>
            </div>
          )}
          {scenario && (
            <div id="printable-scenario" className="space-y-6 animate-fade-in">
              <h1 className="text-2xl font-bold text-white text-center">{scenario.title}</h1>
              
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <h3 className="section-title text-lg font-bold text-cyan-400 mb-2">الهدف التعليمي</h3>
                  <p>{scenario.learning_objective}</p>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <h3 className="section-title text-lg font-bold text-cyan-400 mb-2">وصف السيناريو</h3>
                  <p className="whitespace-pre-wrap leading-relaxed">{scenario.scenario_description}</p>
              </div>

              <div>
                  <h3 className="section-title text-lg font-bold text-cyan-400 mb-4">الخطوات التفاعلية</h3>
                  <div className="space-y-4">
                      {scenario.interactive_steps.map((step, stepIndex) => (
                          <div key={stepIndex} className="step-card bg-slate-800 p-4 rounded-lg border border-slate-600">
                              <h4 className="font-bold text-slate-100 mb-2">{step.step_title}</h4>
                              <p className="text-slate-400 mb-3">{step.situation}</p>
                              <p className="font-semibold text-cyan-300 mb-3">{step.question}</p>
                              <div className="space-y-2">
                                  {step.options.map((opt, optIndex) => (
                                    <div key={optIndex}>
                                      <button 
                                        onClick={() => handleSelectOption(stepIndex, optIndex)}
                                        className={`w-full text-right p-3 rounded-md border-2 transition-colors duration-200
                                          ${selectedAnswers[stepIndex] === optIndex ? (opt.is_correct ? 'border-green-500 bg-green-500/20' : 'border-red-500 bg-red-500/20') : 'border-slate-700 bg-slate-700/50 hover:bg-slate-700'}`}
                                      >
                                        {opt.option_text}
                                      </button>
                                       {selectedAnswers[stepIndex] === optIndex && (
                                           <div className={`feedback mt-2 p-3 rounded-lg text-sm flex items-start gap-2 ${opt.is_correct ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                                             {opt.is_correct ? <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-green-400"/> : <XCircleIcon className="h-5 w-5 flex-shrink-0 text-red-400"/>}
                                             <span>{opt.feedback}</span>
                                           </div>
                                       )}
                                    </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                  <h3 className="section-title text-lg font-bold text-cyan-400 mb-2">نقاط للمناقشة (Debrief)</h3>
                  <ul className="list-disc ps-5 space-y-2">
                      {scenario.debrief_points.map((point, i) => <li key={i}>{point}</li>)}
                  </ul>
              </div>
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-slate-700 text-end flex-shrink-0">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg">إغلاق</button>
        </footer>
      </div>
       <style>{`
        @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        .section-title { 
            font-size: 1.1rem; 
            font-weight: bold; 
            color: #22d3ee; /* cyan-400 */
            border-bottom: 1px solid #334155; /* slate-700 */
            padding-bottom: 8px; 
            margin-bottom: 12px; 
        }
      `}</style>
    </div>
  );
};