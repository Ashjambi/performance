import React, { useContext, useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import type { Pillar } from '../data.tsx';
import { PillarCard } from './PillarCard.tsx';
import { OverallScore } from './OverallScore.tsx';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.tsx';
import { ActionPlans } from './ActionPlans.tsx';
import { Squares2X2Icon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { getManagerSnapshotForPeriod } from '../data.tsx';

export const Dashboard = () => {
  const { managers, selectedManagerId, currentTimePeriod, selectedMonth } = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);
  const [activeTab, setActiveTab] = useState<'pillars' | 'plans'>('pillars');
  
  const selectedManager = managers.find(m => m.id === selectedManagerId);

  const managerForDisplay = useMemo(() => {
    if (!selectedManager) return null;

    if (currentTimePeriod !== 'monthly') {
        return getManagerSnapshotForPeriod(selectedManager, currentTimePeriod);
    }
    
    // For 'monthly' view, the state from the context is now the single source of truth.
    // The reducer handles updating KPI values when the month or manager changes.
    return selectedManager;

  }, [selectedManager, currentTimePeriod]);

  const monthForDisplay = useMemo(() => {
    if (currentTimePeriod !== 'monthly' || !selectedMonth) return null;
    const date = new Date(selectedMonth + '-15'); // Use day 15 to avoid tz issues
    return date.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });
  }, [currentTimePeriod, selectedMonth]);


  if (!managerForDisplay) {
    return null; // Or some fallback UI
  }
  
  const uncompletedPlansCount = managerForDisplay.actionPlans?.filter(plan => 
    plan.steps.some(step => !step.isCompleted)
  ).length || 0;

  return (
    <div className="space-y-8">
      {currentTimePeriod === 'monthly' && monthForDisplay && (
        <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200">
                أنت تعرض بيانات شهر: <span className="text-cyan-400 font-bold">{monthForDisplay}</span>
            </h2>
        </div>
      )}
      <OverallScore managerForDisplay={managerForDisplay} />
      
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-1.5">
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setActiveTab('pillars')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold rounded-md transition-colors ${activeTab === 'pillars' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:bg-slate-700/50'}`}
            >
                <Squares2X2Icon className="h-5 w-5" />
                ركائز الأداء
            </button>
             <button 
                onClick={() => setActiveTab('plans')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold rounded-md transition-colors relative ${activeTab === 'plans' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:bg-slate-700/50'}`}
            >
                <ClipboardDocumentListIcon className="h-5 w-5" />
                خطط العمل
                {uncompletedPlansCount > 0 && (
                    <span className="absolute top-0 end-0 -mt-1 -me-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                        {uncompletedPlansCount}
                    </span>
                )}
            </button>
        </div>
      </div>

      {activeTab === 'pillars' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in-up">
            {managerForDisplay.pillars.map((pillar) => (
            <PillarCard key={pillar.id} pillar={pillar} currentTimePeriod={currentTimePeriod}/>
            ))}
        </div>
      )}

      {activeTab === 'plans' && (
          <div className="animate-fade-in-up">
            <ActionPlans />
          </div>
      )}

    </div>
  );
};