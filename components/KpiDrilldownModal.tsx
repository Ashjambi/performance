

import React, { useMemo, useContext } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { AppStateContext } from '../context/AppContext.tsx';
import { calculateKpiScore } from '../data.tsx';

const getScoreColor = (score) => {
  if (score >= 90) return '#22c55e'; // green-500
  if (score >= 75) return '#facc15'; // yellow-400
  return '#ef4444'; // red-500
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: any[];
  label?: string;
};

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {  
  if (active && payload && payload.length) {
    const data = payload[0];
    const score = data.value;
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm p-3 border border-slate-700 rounded-lg shadow-xl text-sm">
        <p className="text-slate-200 font-bold mb-2">{label}</p>
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
      .sort((a, b) => a.score - b.score); // Sort ascending for horizontal bar chart display
    return data;
  }, [kpi, managers]);

  if (!isOpen || !kpi) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col transition-transform duration-300 scale-95 animate-scale-in"
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
              <p className="text-slate-400 mb-6">يعرض هذا الرسم البياني مقارنة أداء كل مدير لهذا المؤشر. يشير الخط المرجعي عند 100% إلى تحقيق الهدف.</p>
              {/* Increase height based on number of managers to avoid cramped labels */}
              <div style={{width: '100%', height: `${Math.max(300, drilldownData.length * 40)}px`}}> 
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={drilldownData}
                        margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis type="number" stroke="#94a3b8" domain={[0, 'dataMax + 10']} tick={{ fill: '#cbd5e1', fontSize: 12 }}/>
                        <YAxis 
                            type="category" 
                            dataKey="name" 
                            width={150} 
                            stroke="#94a3b8"
                            fontSize={12}
                            tick={{ fill: '#cbd5e1' }}
                            interval={0}
                         />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }}/>
                        <ReferenceLine 
                            x={100} 
                            stroke="#f87171" 
                            strokeDasharray="4 4"
                            label={{ value: "الهدف", position: "insideTopRight", fill: "#f87171", fontSize: 12 }}
                        />
                        <Bar dataKey="score" name="الأداء" barSize={20}>
                            {drilldownData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
                            ))}
                        </Bar>
                    </BarChart>
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
    </div>
  );
};