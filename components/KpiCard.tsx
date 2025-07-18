



import React, { useState, useEffect, useContext } from 'react';
import type { KPI, TimePeriod } from '../data.tsx';
import { calculateKpiScore, RISK_KPI_IDS } from '../data.tsx';
import { InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { PencilIcon } from '@heroicons/react/24/solid';
import { HowToCalculateModal } from './HowToCalculateModal.tsx';
import { HistoricalTrendModal } from './HistoricalTrendModal.tsx';
import { ForecastModal } from './ForecastModal.tsx';
import { RootCauseAnalysisModal } from './RootCauseAnalysisModal.tsx';
import { TrainingScenarioModal } from './TrainingScenarioModal.tsx';
import { AppDispatchContext } from '../context/AppContext.tsx';
import { KpiCardActions } from './KpiCardActions.tsx';


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
  const [isTrainingModalOpen, setIsTrainingModalOpen] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);
  
  const isEditable = currentTimePeriod === 'monthly';
  const isRiskKpi = RISK_KPI_IDS.has(kpi.id);
  const showRcaButton = isEditable && score < 90;

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
      setIsInfoExpanded(false); // Also collapse info section on data change
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
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-1 bg-slate-950 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 border border-slate-500">
                            مؤشر متعلق بالمخاطر
                        </div>
                    </div>
                )}
                <button
                    onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                    className="flex items-center"
                    aria-expanded={isInfoExpanded}
                    aria-controls={`kpi-info-${kpi.id}`}
                    title={isInfoExpanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                >
                    <InformationCircleIcon className={`h-4 w-4 cursor-pointer transition-colors ${isInfoExpanded ? 'text-cyan-400' : 'text-slate-500 hover:text-cyan-500'}`} />
                </button>
             </div>
          </div>
          <div className="flex items-center flex-shrink-0">
            <div 
                className={`text-sm font-bold text-white text-end flex items-center gap-1 ${isEditable ? 'group cursor-pointer' : 'cursor-default'}`}
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
            <KpiCardActions 
                onHowToCalculate={() => setIsHowToModalOpen(true)}
                onTrend={() => setIsTrendModalOpen(true)}
                onForecast={() => setIsForecastModalOpen(true)}
                onRca={showRcaButton ? () => setIsRcaModalOpen(true) : undefined}
                onTrainingScenario={() => setIsTrainingModalOpen(true)}
            />
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
          <span className={`font-bold ${scoreColorClass}`}>الأداء: {Math.round(score)}%</span>
        </div>
        
        {isInfoExpanded && (
            <div id={`kpi-info-${kpi.id}`} className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-300 space-y-2 animate-fade-in-down">
                <div>
                    <p className="font-bold text-cyan-400 mb-0.5">الوصف:</p>
                    <p className="whitespace-normal text-slate-400">{kpi.tooltip.description}</p>
                </div>
                <div>
                    <p className="font-bold text-cyan-400 mb-0.5">مصدر البيانات:</p>
                    <p className="whitespace-normal text-slate-400">{kpi.tooltip.dataSource}</p>
                </div>
                <div>
                    <p className="font-bold text-cyan-400 mb-0.5">الأهمية:</p>
                    <p className="whitespace-normal text-slate-400">{kpi.tooltip.importance}</p>
                </div>
            </div>
        )}
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
      <TrainingScenarioModal
        isOpen={isTrainingModalOpen}
        onClose={() => setIsTrainingModalOpen(false)}
        kpi={kpi}
      />
    </>
  );
};