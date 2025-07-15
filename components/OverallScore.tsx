import React, { useMemo, useState, useContext } from 'react';
import type { Pillar, KPI, AnalysisResult, Recommendation } from '../data.tsx';
import { calculateManagerOverallScore } from '../data.tsx';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { toast } from 'react-hot-toast';
import { AnalysisModal } from './AnalysisModal.tsx';
import { Spinner } from './Spinner.tsx';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.tsx';
import { generatePerformanceAnalysis, generateActionPlanSteps } from '../services/geminiService.tsx';

const getScoreColor = (score) => {
  if (score >= 90) return '#22c55e'; // green-500
  if (score >= 75) return '#facc15'; // yellow-400
  return '#ef4444'; // red-500
};

export const OverallScore = ({ managerForDisplay }) => {
  const { currentTimePeriod } = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);
  const selectedManager = managerForDisplay;
  const pillars = selectedManager?.pillars || [];
  
  const overallScore = useMemo(() => {
    if(!pillars || pillars.length === 0) return 0;
    return calculateManagerOverallScore(pillars);
  }, [pillars]);

  const chartData = [{ name: 'Overall', value: overallScore }];
  const color = getScoreColor(overallScore);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAnalysis = async () => {
      if (!selectedManager) {
        toast.error("لم يتم تحديد مدير لإجراء التحليل.");
        return;
      }
      setIsModalOpen(true);
      setIsLoading(true);
      setError(null);
      setAnalysisResult(null);
      
      const analysisPromise = generatePerformanceAnalysis(managerForDisplay, currentTimePeriod);

      toast.promise(analysisPromise, {
        loading: 'يقوم الذكاء الاصطناعي بالتحليل...',
        success: 'تم إنشاء التحليل بنجاح!',
        error: 'فشل إنشاء التحليل.',
      });

      try {
          const result = await analysisPromise;
          setAnalysisResult(result);
      } catch (e) {
          console.error(e);
          setError("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى لاحقًا.");
      } finally {
          setIsLoading(false);
      }
  };
  
  const handleGeneratePlan = async (recommendation: Recommendation) => {
    if (!selectedManager.id) return;
    const toastId = toast.loading('يقوم الذكاء الاصطناعي بإنشاء خطة العمل...');
    try {
        const { steps } = await generateActionPlanSteps(recommendation.text);
        dispatch({ type: 'ADD_ACTION_PLAN', payload: { managerId: selectedManager.id, recommendation: recommendation.text, steps }});
        toast.success('تم إنشاء خطة العمل وإضافتها بنجاح!', { id: toastId });
    } catch(e) {
        console.error(e);
        toast.error('فشل إنشاء خطة العمل.', { id: toastId });
    }
  }

  return (
    <>
      <div className="bg-slate-800/50 rounded-xl p-6 shadow-2xl backdrop-blur-sm border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="text-center md:text-right flex-grow">
          <h2 className="text-3xl font-bold text-white mb-2">الأداء العام للمدير</h2>
          <p className="text-slate-400 max-w-lg mb-6">
            هذا هو متوسط الأداء الموزون بناءً على جميع ركائز التقييم. يعكس هذا المؤشر الكفاءة الإجمالية في إدارة عمليات المناولة الأرضية.
          </p>
          <button 
              onClick={handleGenerateAnalysis}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed"
          >
              {isLoading ? (
                  <>
                      <Spinner className="h-5 w-5" />
                      <span>جاري التحليل...</span>
                  </>
              ) : (
                  <>
                      <SparklesIcon className="h-5 w-5" />
                      <span>الحصول على تحليل بالذكاء الاصطناعي</span>
                  </>
              )}
          </button>
        </div>
        <div className="relative w-48 h-48 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              data={chartData}
              startAngle={90}
              endAngle={-270}
              barSize={20}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: '#334155' }}
                dataKey="value"
                angleAxisId={0}
                fill={color}
                cornerRadius={10}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold" style={{ color: color }}>{overallScore}%</span>
          </div>
        </div>
      </div>
      <AnalysisModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          isLoading={isLoading}
          analysisResult={analysisResult}
          error={error}
          title="تحليل الأداء والتوصيات"
          onGeneratePlan={handleGeneratePlan}
      />
    </>
  );
};