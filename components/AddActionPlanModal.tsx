

import React, { useState, useContext } from 'react';
import { XMarkIcon, PlusCircleIcon, TrashIcon } from '@heroicons/react/24/solid';
import { AppDispatchContext, AppStateContext } from '../context/AppContext.js';
import { toast } from 'react-hot-toast';

type AddActionPlanModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AddActionPlanModal = ({ isOpen, onClose }: AddActionPlanModalProps) => {
  const dispatch = useContext(AppDispatchContext);
  const { selectedManagerId } = useContext(AppStateContext);
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState('');

  if (!isOpen) return null;

  const handleAddStep = () => {
    if (currentStep.trim()) {
      setSteps([...steps, currentStep.trim()]);
      setCurrentStep('');
    }
  };
  
  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSavePlan = () => {
    if (title.trim() && steps.length > 0 && selectedManagerId) {
      dispatch({ 
          type: 'ADD_MANUAL_ACTION_PLAN', 
          payload: { 
              managerId: selectedManagerId, 
              recommendation: title.trim(), 
              steps 
            }
        });
      toast.success('تمت إضافة خطة العمل بنجاح.');
      // Reset state and close
      setTitle('');
      setSteps([]);
      setCurrentStep('');
      onClose();
    } else {
        toast.error("يرجى إدخال عنوان وخطوة واحدة على الأقل.")
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddStep();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg flex flex-col transition-transform duration-300 scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">إنشاء خطة عمل يدوية</h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
        </header>

        <div className="p-6 space-y-6 text-slate-300 overflow-y-auto">
          <div>
            <label htmlFor="plan-title" className="block text-sm font-medium text-slate-400 mb-2">الهدف الرئيسي / عنوان الخطة</label>
            <input
              id="plan-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تحسين دقة مناولة الأمتعة"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              autoFocus
            />
          </div>
          <div>
             <label htmlFor="plan-step" className="block text-sm font-medium text-slate-400 mb-2">الخطوات التنفيذية</label>
             <div className="flex gap-2">
                 <input
                    id="plan-step"
                    type="text"
                    value={currentStep}
                    onChange={(e) => setCurrentStep(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="أضف خطوة جديدة..."
                    className="flex-grow bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button type="button" onClick={handleAddStep} className="inline-flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700">
                    <PlusCircleIcon className="h-5 w-5"/>
                </button>
             </div>
             <div className="mt-4 space-y-2">
                {steps.map((step, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-900/50 p-2 rounded-md">
                        <span className="text-slate-300">{step}</span>
                        <button type="button" onClick={() => handleRemoveStep(index)} className="text-slate-500 hover:text-red-400">
                            <TrashIcon className="h-5 w-5"/>
                        </button>
                    </div>
                ))}
                {steps.length === 0 && (
                    <p className="text-center text-sm text-slate-500 py-2">لم تتم إضافة أي خطوات بعد.</p>
                )}
             </div>
          </div>
        </div>

        <footer className="p-4 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg">إلغاء</button>
          <button 
            onClick={handleSavePlan}
            disabled={!title.trim() || steps.length === 0}
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-slate-600 disabled:opacity-50"
        >
            حفظ الخطة
        </button>
        </footer>
        <style>{`
            @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
        `}</style>
      </div>
    </div>
  );
};