import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import type { RegisteredRisk } from '../data.tsx';

type RiskCellDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  risks: RegisteredRisk[];
  title: string;
};

export const RiskCellDetailModal = ({ isOpen, onClose, risks, title }: RiskCellDetailModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60]"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700"
            aria-label="إغلاق"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="p-6 overflow-y-auto">
          {risks.length > 0 ? (
            <div className="space-y-3">
              {risks.map(risk => (
                <div key={risk.id} className="bg-slate-900/50 p-3 rounded-md border border-slate-700">
                  <h3 className="font-bold text-orange-400">{risk.risk_title}</h3>
                  <p className="text-sm text-slate-300 mt-1">{risk.risk_description}</p>
                  <p className="text-xs text-slate-500 mt-2">المصدر: {risk.source}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">لا توجد مخاطر في هذا التصنيف.</p>
          )}
        </div>

        <footer className="p-4 border-t border-slate-700 text-end">
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg"
          >
            إغلاق
          </button>
        </footer>
      </div>
    </div>
  );
};