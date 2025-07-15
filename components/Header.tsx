import React, { useContext, useState } from 'react';
import { UserPlusIcon, ChevronDownIcon, PencilSquareIcon, UserIcon, BellIcon } from '@heroicons/react/24/solid';
import { PresentationChartLineIcon } from '@heroicons/react/24/outline';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.js';
import type { Alert, TimePeriod } from '../data.js';
import { ROLES } from '../data.js';
import { AlertsPanel } from './AlertsPanel.js';


type HeaderProps = {
  onAddManager: () => void;
  onEditManager: () => void;
  alerts: Alert[];
};

export const Header = ({ onAddManager, onEditManager, alerts }: HeaderProps) => {
  const { managers, selectedManagerId, currentView, currentTimePeriod } = useContext(AppStateContext);
  const dispatch = useContext(AppDispatchContext);
  const [isAlertsPanelOpen, setIsAlertsPanelOpen] = useState(false);

  const selectedManager = managers.find(m => m.id === selectedManagerId);
  const selectedManagerRoleName = selectedManager ? ROLES[selectedManager.role] : undefined;
  
  const handleManagerChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    dispatch({ type: 'SET_SELECTED_MANAGER', payload: event.target.value });
  };
  
  const handleViewChange = (view: 'manager' | 'executive') => {
      dispatch({ type: 'SET_VIEW', payload: view });
  }

  const handleTimePeriodChange = (period: TimePeriod) => {
      dispatch({ type: 'SET_TIME_PERIOD', payload: period });
  }

  const unreadAlertsCount = alerts.filter(a => !a.isRead).length;

  const TimePeriodSelector = () => (
    <div className="bg-slate-800 p-1 rounded-lg flex items-center border border-slate-700">
        <button
            onClick={() => handleTimePeriodChange('monthly')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentTimePeriod === 'monthly' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700'}`}
        >شهري</button>
        <button
            onClick={() => handleTimePeriodChange('quarterly')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentTimePeriod === 'quarterly' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700'}`}
        >ربع سنوي</button>
        <button
            onClick={() => handleTimePeriodChange('yearly')}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentTimePeriod === 'yearly' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700'}`}
        >سنوي</button>
    </div>
  );

  return (
    <header className="bg-slate-900/70 backdrop-blur-lg shadow-lg sticky top-0 z-50 flex items-center h-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-3xl font-black text-white tracking-wider">SGS</div>
              <div className="flex flex-col">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight whitespace-nowrap">
                    {currentView === 'manager' 
                        ? <>تقييم أداء: <span className="text-cyan-400">{selectedManager?.name || '...'}</span></>
                        : <span className="text-cyan-400">لوحة المتابعة التنفيذية</span>
                    }
                  </h1>
                  {currentView === 'manager' && selectedManager && (
                      <span className="text-sm text-slate-400 font-normal whitespace-nowrap">{selectedManager.department} ({selectedManagerRoleName})</span>
                  )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 flex-nowrap">
               <div className="relative">
                    <button
                        onClick={() => setIsAlertsPanelOpen(prev => !prev)}
                        className="p-3 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
                        title="التنبيهات"
                    >
                        <BellIcon className="h-5 w-5" />
                        {unreadAlertsCount > 0 && (
                             <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                                {unreadAlertsCount}
                            </span>
                        )}
                    </button>
                    {isAlertsPanelOpen && (
                        <AlertsPanel 
                            alerts={alerts} 
                            onClose={() => setIsAlertsPanelOpen(false)}
                        />
                    )}
                </div>

              <TimePeriodSelector />

              <div className="bg-slate-800 p-1 rounded-lg flex items-center border border-slate-700">
                <button 
                  onClick={() => handleViewChange('manager')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-2 ${currentView === 'manager' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700'}`}
                  aria-pressed={currentView === 'manager'}
                >
                  <UserIcon className="h-4 w-4"/>
                  عرض المدير
                </button>
                <button 
                  onClick={() => handleViewChange('executive')}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors flex items-center gap-2 ${currentView === 'executive' ? 'bg-cyan-500 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700'}`}
                  aria-pressed={currentView === 'executive'}
                >
                  <PresentationChartLineIcon className="h-4 w-4"/>
                  العرض التنفيذي
                </button>
              </div>

              {currentView === 'manager' && (
                <>
                  <div className="relative">
                    <select 
                      value={selectedManagerId || ''} 
                      onChange={handleManagerChange}
                      className="appearance-none bg-slate-800 border border-slate-700 text-white font-semibold rounded-md py-2 ps-4 pe-10 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                      aria-label="Select Manager"
                      disabled={managers.length === 0}
                    >
                      {managers.map(manager => (
                        <option key={manager.id} value={manager.id}>
                          {manager.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="h-5 w-5 text-slate-400 absolute top-1/2 -translate-y-1/2 end-3 pointer-events-none" />
                  </div>

                   <button
                    onClick={onEditManager}
                    disabled={!selectedManagerId}
                    className="inline-flex items-center justify-center p-3 bg-slate-700 text-white font-semibold rounded-lg shadow-md hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="تعديل المدير المحدد"
                  >
                    <PencilSquareIcon className="h-5 w-5" />
                  </button>
                </>
              )}

              <button
                onClick={onAddManager}
                className="inline-flex items-center gap-2 px-3 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 transition-all duration-300"
                title="إضافة مدير جديد"
              >
                <UserPlusIcon className="h-5 w-5" />
                <span className="hidden sm:inline">إضافة مدير</span>
              </button>
            </div>
        </div>
      </div>
    </header>
  );
};