import React, { useMemo, useState, useContext, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { AppStateContext } from '../context/AppContext.tsx';
import type { Manager, ExecutiveTab, ManagerWithData } from '../data.tsx';
import { calculateManagerOverallScore, calculatePillarScore, calculateKpiScore, getManagerSnapshotForPeriod } from '../data.tsx';
import { Spinner } from './Spinner.tsx';
import { Squares2X2Icon, ShieldCheckIcon, ClipboardDocumentCheckIcon, BeakerIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { generateBulkRiskProfiles } from '../services/geminiService.tsx';
import { ManagerMatrix } from './ManagerMatrix.tsx';
import { ExecutiveActionHub } from './ExecutiveActionHub.tsx';
import RiskAssessmentTab from './RiskAssessmentTab.tsx';
import { ExecutiveOverviewTab } from './ExecutiveOverviewTab.tsx';
import RiskRegisterTab from './RiskRegisterTab.tsx';


// Prop type for the component
type ExecutiveDashboardProps = {
    onEditManager: (managerId: string) => void;
    onGenerateReport: (managerId: string) => void;
};

// Main Component
export const ExecutiveDashboard = ({ onEditManager, onGenerateReport }: ExecutiveDashboardProps): JSX.Element => {
    const { managers, currentTimePeriod } = useContext(AppStateContext);

    // State for Modals & UI
    const [currentTab, setCurrentTab] = useState<ExecutiveTab>('overview');

    // State for Manager Matrix
    const [managersWithRiskProfiles, setManagersWithRiskProfiles] = useState<ManagerWithData[]>([]);
    const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);

    // Memoized Data Calculations (at the top level)
    const managersForDisplay = useMemo(() => {
        return managers.map(manager => getManagerSnapshotForPeriod(manager, currentTimePeriod));
    }, [managers, currentTimePeriod]);

    const stationOverallScore = useMemo(() => {
        if (managersForDisplay.length === 0) return 0;
        const totalScore = managersForDisplay.reduce((acc, manager) => acc + calculateManagerOverallScore(manager.pillars), 0);
        return Math.round(totalScore / managersForDisplay.length);
    }, [managersForDisplay]);

    const pillarPerformance = useMemo(() => {
        const pillarScores = new Map<string, { totalScore: number; count: number; name: string, id: string }>();
        managersForDisplay.forEach(manager => {
            manager.pillars.forEach(pillar => {
                const score = calculatePillarScore(pillar);
                const current = pillarScores.get(pillar.id) || { totalScore: 0, count: 0, name: pillar.name, id: pillar.id };
                pillarScores.set(pillar.id, {
                    ...current,
                    totalScore: current.totalScore + score,
                    count: current.count + 1,
                });
            });
        });
        return Array.from(pillarScores.values()).map(p => ({
            id: p.id,
            name: p.name,
            score: Math.round(p.totalScore / p.count),
        })).sort((a,b) => b.score - a.score);
    }, [managersForDisplay]);
    
     const kpiRanking = useMemo(() => {
        const kpiMap = new Map<string, { scores: number[], name: string }>();
        managersForDisplay.forEach(manager => {
            manager.pillars.forEach(pillar => {
                pillar.kpis.forEach(kpi => {
                    if (!kpiMap.has(kpi.id)) {
                        kpiMap.set(kpi.id, { scores: [], name: kpi.name });
                    }
                    kpiMap.get(kpi.id)!.scores.push(calculateKpiScore(kpi));
                });
            });
        });
        const rankedKpis = Array.from(kpiMap.entries()).map(([id, data]) => {
            const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
            return { id, name: data.name, score: Math.round(avgScore) };
        });
        rankedKpis.sort((a, b) => a.score - b.score);
        return {
            bottom: rankedKpis.slice(0, 5),
            top: rankedKpis.slice(-5).reverse(),
        };
    }, [managersForDisplay]);

    const managerPerformance = useMemo(() => {
        return managersForDisplay
            .map(manager => ({
                id: manager.id,
                name: manager.name,
                score: calculateManagerOverallScore(manager.pillars),
            }))
            .sort((a, b) => b.score - a.score);
    }, [managersForDisplay]);
    
     // Fetch risk profiles when matrix tab is selected
    useEffect(() => {
        const fetchRiskProfiles = async () => {
            if (currentTab !== 'matrix' || managersWithRiskProfiles.length > 0) return;

            setIsLoadingMatrix(true);
            try {
                const riskProfilesMap = await generateBulkRiskProfiles(managersForDisplay, currentTimePeriod);
                
                const profiles: ManagerWithData[] = managersForDisplay.map(manager => ({
                    id: manager.id,
                    name: manager.name,
                    score: calculateManagerOverallScore(manager.pillars),
                    riskProfile: riskProfilesMap[manager.id] || null
                }));

                setManagersWithRiskProfiles(profiles);
            } catch (error) {
                console.error(`Failed to get bulk risk profiles:`, error);
                toast.error("فشل تحميل ملفات المخاطر للمدراء.");
                 // Still populate the list but without risk profiles so the UI doesn't break
                const profiles: ManagerWithData[] = managersForDisplay.map(manager => ({
                    id: manager.id,
                    name: manager.name,
                    score: calculateManagerOverallScore(manager.pillars),
                    riskProfile: null
                }));
                setManagersWithRiskProfiles(profiles);
            } finally {
                setIsLoadingMatrix(false);
            }
        };

        fetchRiskProfiles();
    }, [currentTab, managersForDisplay, currentTimePeriod, managersWithRiskProfiles.length]);

    
    return (
        <div className="space-y-8">
            
            {/* Tabs */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-1.5 flex flex-wrap items-center gap-2">
                {(Object.entries({
                    overview: { label: 'نظرة عامة', icon: Squares2X2Icon },
                    matrix: { label: 'مصفوفة الأداء والمخاطر', icon: ShieldCheckIcon },
                    risk_assessment: { label: 'تحليل المخاطر الإجرائي', icon: BeakerIcon},
                    risk_register: {label: 'سجل المخاطر المتكامل', icon: ShieldExclamationIcon },
                    action_hub: { label: 'مركز متابعة الخطط', icon: ClipboardDocumentCheckIcon },
                }) as [ExecutiveTab, { label: string, icon: React.ElementType }][]).map(([tabId, { label, icon: Icon }]) => (
                    <button
                        key={tabId}
                        onClick={() => setCurrentTab(tabId)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-semibold rounded-md transition-colors ${currentTab === tabId ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:bg-slate-700/50'}`}
                    >
                        <Icon className="h-5 w-5" />
                        {label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div id="executive-report-content" className="p-1">
                {currentTab === 'overview' && (
                    <ExecutiveOverviewTab 
                        managers={managers}
                        managersForDisplay={managersForDisplay}
                        stationOverallScore={stationOverallScore}
                        pillarPerformance={pillarPerformance}
                        kpiRanking={kpiRanking}
                        managerPerformance={managerPerformance}
                        currentTimePeriod={currentTimePeriod}
                        onEditManager={onEditManager}
                        onGenerateReport={onGenerateReport}
                    />
                )}
                {currentTab === 'matrix' && <ManagerMatrix managersData={managersWithRiskProfiles} isLoading={isLoadingMatrix} />}
                {currentTab === 'risk_assessment' && <RiskAssessmentTab />}
                {currentTab === 'risk_register' && <RiskRegisterTab />}
                {currentTab === 'action_hub' && <ExecutiveActionHub managers={managers} />}
            </div>

        </div>
    );
};