
import React, { useMemo, useState } from 'react';
import type { Pillar, TimePeriod } from '../data.tsx';
import { calculatePillarScore } from '../data.tsx';
import { ChartBarIcon, ShieldCheckIcon, BanknotesIcon, UserGroupIcon, HeartIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { PillarDetailModal } from './PillarDetailModal.tsx';

type PillarCardProps = {
  pillar: Pillar;
  currentTimePeriod: TimePeriod;
};

const ICONS = {
  ChartBarIcon: ChartBarIcon,
  ShieldCheckIcon: ShieldCheckIcon,
  BanknotesIcon: BanknotesIcon,
  UserGroupIcon: UserGroupIcon,
  HeartIcon: HeartIcon,
  ArchiveBoxIcon: ArchiveBoxIcon,
};

const getScoreColor = (score) => {
    if (score >= 90) return '#22c55e'; // green-500
    if (score >= 75) return '#facc15'; // yellow-400
    return '#ef4444'; // red-500
};

export const PillarCard = ({ pillar, currentTimePeriod }: PillarCardProps) => {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const pillarScore = useMemo(() => {
    return calculatePillarScore(pillar);
  }, [pillar]);
  
  const scoreColor = getScoreColor(pillarScore);
  const chartData = [{ name: 'score', value: pillarScore }];

  const IconComponent = ICONS[pillar.iconName];

  return (
    <>
      <div 
        className="bg-slate-800 rounded-lg shadow-lg p-5 flex flex-col h-full border border-slate-700 hover:border-cyan-500 transition-colors duration-300 cursor-pointer"
        onClick={() => setIsDetailModalOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={`عرض تفاصيل ركيزة ${pillar.name}`}
        onKeyDown={(e) => e.key === 'Enter' && setIsDetailModalOpen(true)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center">
            <div className="p-2 bg-slate-700 rounded-md me-4">
              {IconComponent && <IconComponent className="h-6 w-6 text-cyan-400" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-100">{pillar.name}</h3>
              <p className="text-sm text-slate-400">الوزن: {pillar.weight}%</p>
            </div>
          </div>
        </div>

        <div className="flex-grow flex items-center justify-center relative w-full h-32 sm:h-40">
           <ResponsiveContainer width="100%" height="100%">
             <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              data={chartData}
              startAngle={180}
              endAngle={0}
              barSize={15}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar
                background={{ fill: '#334155' }}
                dataKey="value"
                angleAxisId={0}
                fill={scoreColor}
                cornerRadius={10}
              />
            </RadialBarChart>
          </ResponsiveContainer>
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2" style={{ top: '65%' }}>
              <span className="text-4xl font-bold" style={{ color: scoreColor }}>{pillarScore}%</span>
           </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-2">انقر لعرض تفاصيل المؤشرات</p>
      </div>
      
      <PillarDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        pillar={pillar}
        currentTimePeriod={currentTimePeriod}
      />
    </>
  );
};
