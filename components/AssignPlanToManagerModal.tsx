

import React, { useState, useMemo, useEffect } from 'react';
import { XMarkIcon, RocketLaunchIcon } from '@heroicons/react/24/solid';
import type { Recommendation, Manager } from '../data.tsx';
import { ROLES } from '../data.tsx';

type AssignPlanToManagerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAssign: (managerId: string, recommendationText: string) => void;
  recommendation: Recommendation | null;
  managers: Manager[];
};

export const AssignPlanToManagerModal = ({ isOpen, onClose, onAssign, recommendation, managers }: AssignPlanToManagerModalProps) => {
  const [selectedManagerId, setSelectedManagerId] = useState('');

  const relevantManagers = useMemo(() => {
    if (!recommendation) return [];
    return managers.filter(m => m.role === recommendation.targetRole);
  }, [managers, recommendation]);
  
  // Effect to set the default selected manager when the modal opens or managers change
  useEffect(() => {
    if (isOpen && relevantManagers.length > 0) {
      setSelectedManagerId(relevantManagers[0].id);
    } else if (!isOpen) {
      setSelectedManagerId('');
    }
  }, [isOpen, relevantManagers]);

  if (!isOpen || !recommendation) return null;

  const handleAssignClick = () => {
    if (selectedManagerId) {
      onAssign(selectedManagerId, recommendation.text);
      onClose(); // Close modal after assignment
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60] transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg flex flex-col transition-transform duration-300 scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <RocketLaunchIcon className="h-6 w-6 text-cyan-400" />
            إسناد خطة عمل
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
        </header>

        <div className="p-6 space-y-4 text-slate-300">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">التوصية</label>
            <p className="bg-slate-900/50 p-3 rounded-md border border-slate-700">{recommendation.text}</p>
          </div>
          <div>
            <label htmlFor="manager-select" className="block text-sm font-medium text-slate-400 mb-1">
              إسناد إلى مدير في قسم: <span className="font-bold text-cyan-400">{ROLES[recommendation.targetRole]}</span>
            </label>
            {relevantManagers.length > 0 ? (
                <select 
                    id="manager-select"
                    value={selectedManagerId}
                    onChange={e => setSelectedManagerId(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                    {relevantManagers.map(manager => (
                        <option key={manager.id} value={manager.id}>{manager.name}</option>
                    ))}
                </select>
            ) : (
                <p className="text-yellow-500 bg-yellow-900/30 p-3 rounded-md border border-yellow-700/50">
                    لا يوجد مدراء حالياً في هذا القسم لإسناد الخطة إليهم.
                </p>
            )}
          </div>
        </div>

        <footer className="p-4 border-t border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg">إلغاء</button>
          <button 
            onClick={handleAssignClick} 
            disabled={!selectedManagerId}
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-slate-600 disabled:opacity-50"
          >
            إسناد وإنشاء الخطة
          </button>
        </footer>
      </div>
    </div>
  );
};