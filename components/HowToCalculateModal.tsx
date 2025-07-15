
import React, { useState, useEffect, useMemo, useContext } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { CalculatorIcon, LightBulbIcon, SparklesIcon, ScaleIcon, ClockIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import type { KPI, CalculationGuide, CalculationFormula } from '../data.tsx';
import { Spinner } from './Spinner.tsx';
import { generateCalculationGuide } from '../services/geminiService.tsx';
import { AppDispatchContext } from '../context/AppContext.tsx';

type HowToCalculateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  kpi: KPI;
  pillarId: string;
};

type FormValues = { [key: string]: string };

const Section = ({ icon, title, children }) => (
    <div className="mb-6">
        <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
            {icon}
            {title}
        </h3>
        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-3">
            {children}
        </div>
    </div>
);

const getUnitLabel = (unit: KPI['unit'], value: number | string): string => {
  switch (unit) {
    case 'percentage': return '%';
    case 'minutes': return 'دقيقة';
    case 'per_1000_pax': return '/1000 راكب';
    case 'per_1000_mov': return '/1000 حركة';
    case 'incidents': return Number(value) === 1 ? 'حادثة' : 'حوادث';
    case 'score': return 'نقطة';
    case 'currency': return 'ر.س';
    case 'days': return 'أيام';
    default: return '';
  }
};

const calculateKpiValue = (formula: CalculationFormula, values: FormValues): number | null => {
    const numericValues: { [key: string]: number } = {};
    for (const key in values) {
        const num = parseFloat(values[key]);
        if (isNaN(num)) return null; // Invalid number input
        numericValues[key] = num;
    }

    try {
        switch (formula.name) {
            case 'average': {
                const [numeratorId, denominatorId] = formula.input_ids;
                const denominator = numericValues[denominatorId];
                if (denominator === 0) return 0;
                return (numericValues[numeratorId] / denominator);
            }
            case 'division_percent': {
                const [numeratorId, denominatorId] = formula.input_ids;
                const denominator = numericValues[denominatorId];
                if (denominator === 0) return 0;
                return (numericValues[numeratorId] / denominator) * 100;
            }
            case 'rate_per_1000': {
                const [numeratorId, denominatorId] = formula.input_ids;
                const denominator = numericValues[denominatorId];
                if (denominator === 0) return 0;
                return (numericValues[numeratorId] / denominator) * 1000;
            }
            case 'simple_value': {
                const [valueId] = formula.input_ids;
                return numericValues[valueId];
            }
            default:
                return null;
        }
    } catch (e) {
        console.error("Calculation failed", e);
        return null;
    }
};

export const HowToCalculateModal = ({ isOpen, onClose, kpi, pillarId }: HowToCalculateModalProps) => {
  const dispatch = useContext(AppDispatchContext);
  const [guide, setGuide] = useState<CalculationGuide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [calculatedValue, setCalculatedValue] = useState<number | null>(null);
  
  const handleFormChange = (id: string, value: string) => {
      setFormValues(prev => ({...prev, [id]: value}));
      setCalculatedValue(null); // Reset calculation if inputs change
  };

  const isFormComplete = useMemo(() => {
    if (!guide?.inputFields) return false;
    return guide.inputFields.every(field => formValues[field.id] && formValues[field.id].trim() !== '');
  }, [guide, formValues]);

  const handleCalculate = () => {
      if (!guide || !isFormComplete) return;
      const result = calculateKpiValue(guide.formula, formValues);
      if (result !== null) {
        // Round to 2 decimal places for display
        const roundedResult = Math.round(result * 100) / 100;
        setCalculatedValue(roundedResult);
        toast.success(`تم حساب النتيجة: ${roundedResult.toLocaleString()}`);
      } else {
        setError("فشل الحساب. يرجى التحقق من المدخلات.");
        toast.error("فشل الحساب. يرجى التحقق من المدخلات.");
      }
  };
  
  const handleApply = () => {
    if (calculatedValue === null) return;
    dispatch({ type: 'UPDATE_KPI', payload: { pillarId, kpiId: kpi.id, value: calculatedValue } });
    toast.success(`تم تحديث قيمة "${kpi.name}" بنجاح.`);
    onClose();
  };

  useEffect(() => {
    const fetchGuide = async () => {
      if (!isOpen || !kpi) return;

      // Reset state on open
      setIsLoading(true);
      setError(null);
      setGuide(null);
      setFormValues({});
      setCalculatedValue(null);

      try {
        const result = await generateCalculationGuide(kpi);
        setGuide(result);

      } catch (e) {
        console.error(e);
        setError("حدث خطأ أثناء إنشاء الدليل. يرجى المحاولة مرة أخرى.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuide();
  }, [isOpen, kpi]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col transition-transform duration-300 scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalculatorIcon className="h-6 w-6 text-cyan-400" />
            الحاسبة التفاعلية: {kpi.name}
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" aria-label="إغلاق">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto text-slate-300">
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Spinner className="" />
              <p>جاري إعداد الحاسبة بواسطة الذكاء الاصطناعي...</p>
            </div>
          )}
          {error && (
            <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg">
              <h3 className="font-bold mb-2">حدث خطأ</h3>
              <p>{error}</p>
            </div>
          )}
          {guide && !isLoading && (
            <div className="animate-fade-in">
              <Section icon={<ClockIcon className="h-5 w-5"/>} title="1. إدخال البيانات">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {guide.inputFields.map(field => (
                        <div key={field.id}>
                            <label htmlFor={field.id} className="block text-sm font-medium text-slate-400 mb-1">{field.label}</label>
                            <input
                                id={field.id}
                                type="number"
                                value={formValues[field.id] || ''}
                                onChange={(e) => handleFormChange(field.id, e.target.value)}
                                placeholder="أدخل القيمة هنا..."
                                className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    ))}
                </div>
              </Section>
              
              <Section icon={<SparklesIcon className="h-5 w-5"/>} title="2. حساب النتيجة">
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <button
                      onClick={handleCalculate}
                      disabled={!isFormComplete || isLoading}
                      className="w-full md:w-auto flex-1 inline-flex justify-center items-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all"
                    >
                      <CalculatorIcon className="h-5 w-5" />
                      حساب النتيجة
                    </button>
                    {calculatedValue !== null && (
                        <div className="text-center bg-slate-950 p-3 rounded-lg border border-green-500/50 flex-1">
                            <span className="text-slate-400 text-sm">النتيجة المحسوبة:</span>
                            <span className="text-green-400 font-bold text-lg ms-2">{calculatedValue.toLocaleString()} <span className="text-xs">{getUnitLabel(kpi.unit, calculatedValue)}</span></span>
                        </div>
                    )}
                </div>
              </Section>
              
              <Section icon={<LightBulbIcon className="h-5 w-5"/>} title="3. دليل إرشادي">
                 <p>{guide.objective}</p>
                 <details className="bg-slate-800/50 p-2 rounded-md mt-2 cursor-pointer">
                    <summary className="text-cyan-400 font-semibold">عرض خطوات الحساب والمثال</summary>
                    <div className="mt-3 border-t border-slate-700 pt-3">
                         <h4 className="font-bold text-slate-200 mb-2">خطوات الحساب:</h4>
                         <ol className="list-decimal list-inside space-y-2 mb-4">
                             {guide.steps.map((step, index) => <li key={index}>{step}</li>)}
                         </ol>
                         <h4 className="font-bold text-slate-200 mb-2">مثال عملي:</h4>
                         <p className="whitespace-pre-wrap leading-relaxed text-slate-400">{guide.example}</p>
                         <h4 className="font-bold text-slate-200 mt-4 mb-2">نصيحة الخبير:</h4>
                         <p className="text-slate-400">{guide.tip}</p>
                    </div>
                 </details>
              </Section>
            </div>
          )}
        </div>
        <footer className="p-4 border-t border-slate-700 flex justify-end items-center gap-3 flex-shrink-0">
             <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                إلغاء
            </button>
            <button
                onClick={handleApply}
                disabled={calculatedValue === null}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                تطبيق وحفظ القيمة
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
