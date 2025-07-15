
import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import type { Pillar, TimePeriod } from '../data.js';
import { KpiCard } from './KpiCard.js';
import { ChartBarIcon, ShieldCheckIcon, BanknotesIcon, UserGroupIcon, HeartIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';

const ICONS = {
  ChartBarIcon: ChartBarIcon,
  ShieldCheckIcon: ShieldCheckIcon,
  BanknotesIcon: BanknotesIcon,
  UserGroupIcon: UserGroupIcon,
  HeartIcon: HeartIcon,
  ArchiveBoxIcon: ArchiveBoxIcon,
};


type PillarDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  pillar: Pillar;
  currentTimePeriod: TimePeriod;
};

export const PillarDetailModal = ({ isOpen, onClose, pillar, currentTimePeriod }: PillarDetailModalProps) => {
  if (!isOpen) return null;

  const IconComponent = ICONS[pillar.iconName];

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
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            {IconComponent && <IconComponent className="h-6 w-6 text-cyan-400" />}
            تفاصيل ركيزة: {pillar.name}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="إغلاق"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto text-slate-300 space-y-4">
           {pillar.kpis.map((kpi) => (
              <KpiCard key={kpi.id} pillarId={pillar.id} kpi={kpi} currentTimePeriod={currentTimePeriod} />
            ))}
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
      `}</style>
    </div>
  );
};