



import React, { useState, useEffect, useContext } from 'react';
import type { KPI, TimePeriod } from '../data.tsx';
import { calculateKpiScore, RISK_KPI_IDS } from '../data.tsx';
import { InformationCircleIcon, CalculatorIcon, ArrowTrendingUpIcon, CpuChipIcon, DocumentMagnifyingGlassIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { PencilIcon } from '@heroicons/react/24/solid';
import { HowToCalculateModal } from './HowToCalculateModal.tsx';
import { HistoricalTrendModal } from './HistoricalTrendModal.tsx';
import { ForecastModal } from './ForecastModal.tsx';
import { RootCauseAnalysisModal } from './RootCauseAnalysisModal.tsx';
import { AppDispatchContext } from '../context/AppContext.tsx';


type KpiCardProps = {
  kpi: KPI;
  pillarId: string;
  currentTimePeriod: TimePeriod;
};

const getUnitLabel = (unit, value) => {
  switch (unit) {
    case 'percentage': return '%';
    case 'minutes': return 'دقيقة';
    case 'per_1000_pax': return '/1000 راكب';
    case 'per_1000_mov': return '/1000 حركة';
    case 'incidents': return value === 1 ? 'حادثة' : 'حوادث';
    case 'score': return 'نقطة';
    case 'currency': return 'ر.س';
    case 'days': return 'أيام';
    default: return '';
  }
};

export const KpiCard = ({ kpi, pillarId, currentTimePeriod }: KpiCardProps) => {
  const dispatch = useContext(AppDispatchContext);
  const score = calculateKpiScore(kpi);
  const progressBarColor = score >= 90 ? 'bg-green-500' : score >= 75 ? 'bg-yellow-500' : 'bg-red-500';
  const scoreColorClass = score >= 90 ? 'text-green-400' : score >= 75 ? 'text-yellow-400' : 'text-red-400';

  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(String(kpi.value));
  const [isHowToModalOpen, setIsHowToModalOpen] = useState(false);
  const [isTrendModalOpen, setIsTrendModalOpen] = useState(false);
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [isRcaModalOpen, setIsRcaModalOpen] = useState(false);
  
  const isEditable = currentTimePeriod === 'monthly';
  const isRiskKpi = RISK_KPI_IDS.has(kpi.id);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCurrentValue(value);
  };

  const updateKpiValue = (value: number) => {
     dispatch({
        type: 'UPDATE_KPI',
        payload: { pillarId, kpiId: kpi.id, value }
    });
  };

  const handleBlur = () => {
    const numericValue = parseFloat(currentValue);
    if (!isNaN(numericValue) && numericValue !== kpi.value) {
      updateKpiValue(numericValue);
    } else {
        // if input is invalid or unchanged, revert to original value
        setCurrentValue(String(kpi.value));
    }
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleBlur();
      (e.target as HTMLInputElement).blur(); // remove focus
    } else if (e.key === 'Escape') {
      setCurrentValue(String(kpi.value));
      setIsEditing(false);
      (e.target as HTMLInputElement).blur();
    }
  };

  // Update local state if prop changes (e.g., manager switched or period changed)
  useEffect(() => {
      setCurrentValue(String(kpi.value));
  }, [kpi.value]);


  return (
    <>
      <div className={`bg-slate-800/50 p-3 rounded-md border ${isRiskKpi ? 'border-red-500/30' : 'border-slate-700'}`}>
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex items-center flex-shrink min-w-0">
            <h4 className="text-sm font-medium text-slate-300 truncate">{kpi.name}</h4>
             <div className="flex items-center ms-2 flex-shrink-0">
                {isRiskKpi && (
                    <div className="group relative flex items-center me-1">
                        <ExclamationTriangleIcon className="h-4 w-4 text-red-400 cursor-help" />
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-slate-950 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-600">
                            مؤشر متعلق بالمخاطر
                        </div>
                    </div>
                )}
                <div className="group relative flex items-center">
                    <InformationCircleIcon className="h-4 w-4 text-slate-500 cursor-pointer" />
                    <div className="absolute bottom-full mb-2 end-0 w-64 p-3 bg-slate-900 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-600">
                        <p className="font-bold mb-1 text-cyan-400">الوصف:</p>
                        <p className="mb-2 whitespace-normal">{kpi.tooltip.description}</p>
                        <p className="font-bold mb-1 text-cyan-400">مصدر البيانات:</p>
                        <p className="mb-2 whitespace-normal">{kpi.tooltip.dataSource}</p>
                        <p className="font-bold mb-1 text-cyan-400">الأهمية:</p>
                        <p className="whitespace-normal">{kpi.tooltip.importance}</p>
                    </div>
                </div>
                <button onClick={() => setIsHowToModalOpen(true)} className="group relative flex items-center ms-1" aria-label="الحاسبة التفاعلية">
                    <CalculatorIcon className="h-4 w-4 text-slate-500 cursor-pointer hover:text-cyan-400 transition-colors" />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-slate-950 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-600">
                        الحاسبة التفاعلية
                    </div>
                </button>
                 <button onClick={() => setIsTrendModalOpen(true)} className="group relative flex items-center ms-1" aria-label="تحليل الاتجاه التاريخي">
                    <ArrowTrendingUpIcon className="h-4 w-4 text-slate-500 cursor-pointer hover:text-cyan-400 transition-colors" />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-slate-950 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-600">
                        تحليل الاتجاه التاريخي
                    </div>
                </button>
                <button onClick={() => setIsForecastModalOpen(true)} className="group relative flex items-center ms-1" aria-label="التنبؤ المستقبلي">
                    <CpuChipIcon className="h-4 w-4 text-slate-500 cursor-pointer hover:text-cyan-400 transition-colors" />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-slate-950 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-600">
                        التنبؤ المستقبلي
                    </div>
                </button>
             </div>
          </div>
          <div 
            className={`text-sm font-bold text-white text-end flex-shrink-0 flex items-center gap-1 ${isEditable ? 'group cursor-pointer' : 'cursor-default'}`}
            onClick={() => isEditable && setIsEditing(true)}
          >
            {isEditing && isEditable ? (
              <input
                type="number"
                value={currentValue}
                onChange={handleValueChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="bg-slate-700 text-white w-20 text-end rounded p-1 outline-none ring-2 ring-cyan-500"
                autoFocus
                step="0.1"
              />
            ) : (
              <>
                {isEditable && <PencilIcon className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"/>}
                <span>{kpi.value.toLocaleString()}</span>
              </>
            )}
            <span className="text-xs text-slate-400 ms-1">{getUnitLabel(kpi.unit, kpi.value)}</span>
          </div>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${progressBarColor} transition-all duration-500`}
            style={{ width: `${Math.min(score, 100)}%` }}
          ></div>
        </div>
        <div className="flex justify-between items-center text-xs text-slate-500 mt-1">
          <span className="flex items-center gap-2">
              <span>الهدف: {kpi.target.toLocaleString()}</span>
              {kpi.benchmark && (
                  <>
                      <span className="text-slate-600">|</span>
                      <span className="group relative" title={`المرجع: ${kpi.benchmark.source}`}>
                          النموذجي: {kpi.benchmark.target.toLocaleString()}
                      </span>
                  </>
              )}
          </span>
          <div className="flex items-center gap-2">
            {isEditable && score < 90 && (
              <button
                onClick={() => setIsRcaModalOpen(true)}
                className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 font-semibold text-xs flex items-center gap-1 border border-cyan-500/20"
                aria-label="تشخيص السبب الجذري"
              >
                <DocumentMagnifyingGlassIcon className="h-3 w-3" />
                <span>تشخيص</span>
              </button>
            )}
            <span className={`font-bold ${scoreColorClass}`}>الأداء: {Math.round(score)}%</span>
          </div>
        </div>
      </div>
      <HowToCalculateModal
        isOpen={isHowToModalOpen}
        onClose={() => setIsHowToModalOpen(false)}
        kpi={kpi}
        pillarId={pillarId}
      />
      <HistoricalTrendModal
        isOpen={isTrendModalOpen}
        onClose={() => setIsTrendModalOpen(false)}
        kpi={kpi}
      />
      <ForecastModal
        isOpen={isForecastModalOpen}
        onClose={() => setIsForecastModalOpen(false)}
        kpi={kpi}
      />
       <RootCauseAnalysisModal
        isOpen={isRcaModalOpen}
        onClose={() => setIsRcaModalOpen(false)}
        kpi={kpi}
      />
    </>
  );
};