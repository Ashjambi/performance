

import React, { useMemo, useContext } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { AppStateContext } from '../context/AppContext.js';
import { calculateKpiScore } from '../data.js';

const getScoreColor = (score) => {
  if (score >= 90) return '#22c55e'; // green-500
  if (score >= 75) return '#facc15'; // yellow-400
  return '#ef4444'; // red-500
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: any[];
};

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {  
  if (active && payload && payload.length) {
    const data = payload[0];
    const score = data.value;
    const name = data.name;
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm p-3 border border-slate-700 rounded-lg shadow-xl text-sm">
        <p className="text-slate-200 font-bold mb-2">{name}</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getScoreColor(score) }}></span>
          <p className="text-slate-300">
              الأداء: <span className="font-bold" style={{ color: getScoreColor(score) }}>{`${score}%`}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

type KpiDrilldownModalProps = {
  isOpen: boolean;
  onClose: () => void;
  kpi: { id: string; name: string } | null;
};

export const KpiDrilldownModal = ({ isOpen, onClose, kpi }: KpiDrilldownModalProps) => {
  const { managers } = useContext(AppStateContext);

  const drilldownData = useMemo(() => {
    if (!kpi || !managers) return [];

    const data = managers
      .map(manager => {
        let managerKpi = null;
        for (const pillar of manager.pillars) {
          const foundKpi = pillar.kpis.find(k => k.id === kpi.id);
          if (foundKpi) {
            managerKpi = foundKpi;
            break;
          }
        }
        if (managerKpi) {
          return {
            name: manager.name,
            score: Math.round(calculateKpiScore(managerKpi)),
          };
        }
        return null;
      })
      .filter((item): item is { name: string; score: number } => item !== null)
      .sort((a, b) => b.score - a.score);
    return data;
  }, [kpi, managers]);

  if (!isOpen || !kpi) return null;

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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ChartBarIcon className="h-6 w-6 text-cyan-400" />
            تفاصيل الأداء: {kpi.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="إغلاق"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto text-slate-300">
          {drilldownData.length > 0 ? (
            <>
              <p className="text-slate-400 mb-4">يعرض هذا الرسم البياني أداء كل مدير على حدة لهذا المؤشر، مما يوضح المساهمين الرئيسيين في الأداء العام.</p>
              <div style={{width: '100%', height: `350px`}}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie
                            data={drilldownData}
                            dataKey="score"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={70}
                            labelLine={false}
                            paddingAngle={5}
                        >
                            {drilldownData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{fontSize: '12px', paddingTop: '20px', paddingBottom: '10px'}}/>
                    </PieChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
                <p className="text-slate-400">لا يوجد مدراء لديهم هذا المؤشر المحدد في ركائز التقييم الخاصة بهم.</p>
            </div>
          )}
        </div>
        <footer className="p-4 border-t border-slate-700 text-end flex-shrink-0">
             <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">
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
      `}</style>
    </div>
  );
};