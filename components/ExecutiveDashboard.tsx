


import React, { useMemo, useState, useContext, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.js';
import type { Manager, Pillar, KPI, AnalysisResult, ManagerRole, Recommendation, RiskProfile, ExecutiveTab, ManagerWithData } from '../data.js';
import { calculateManagerOverallScore, calculatePillarScore, calculateKpiScore, getManagerSnapshotForPeriod } from '../data.js';
import { AnalysisModal } from './AnalysisModal.js';
import { Spinner } from './Spinner.js';
import { SparklesIcon, PresentationChartLineIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon, CpuChipIcon, TrophyIcon, ArrowDownTrayIcon, DocumentMagnifyingGlassIcon, Squares2X2Icon, ShieldCheckIcon, ClipboardDocumentCheckIcon, DocumentTextIcon, BeakerIcon } from '@heroicons/react/24/outline';
import { PencilSquareIcon } from '@heroicons/react/24/solid';
import { generateExecutiveAnalysis, generateExecutiveForecastAnalysis, generateActionPlanSteps, generatePillarDiagnosis, generateBulkRiskProfiles } from '../services/geminiService.js';
import type { PillarDiagnosisResult } from '../services/geminiService.js';
import { KpiDrilldownModal } from './KpiDrilldownModal.js';
import { CompetitionModal } from './CompetitionModal.js';
import { WhatIfSimulationCard } from './WhatIfSimulationCard.js';
import { PillarDiagnosisModal } from './PillarDiagnosisModal.js';
import { AssignPlanToManagerModal } from './AssignPlanToManagerModal.js';
import { SmartSummaryCard } from './SmartSummaryCard.js';
import { ManagerMatrix } from './ManagerMatrix.js';
import { ExecutiveActionHub } from './ExecutiveActionHub.js';
import RiskAssessmentTab from './RiskAssessmentTab.js';


declare var html2canvas: any;
declare var jspdf: any;

// Prop type for the component
type ExecutiveDashboardProps = {
    onEditManager: (managerId: string) => void;
    onGenerateReport: (managerId: string) => void;
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


// Main Component
export const ExecutiveDashboard = ({ onEditManager, onGenerateReport }: ExecutiveDashboardProps): JSX.Element => {
    const { managers, currentTimePeriod } = useContext(AppStateContext);
    const dispatch = useContext(AppDispatchContext);

    // State for Modals & UI
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [currentTab, setCurrentTab] = useState<ExecutiveTab>('overview');
    const [selectedKpiForDrilldown, setSelectedKpiForDrilldown] = useState<{ id: string; name: string } | null>(null);
    const [isCompetitionModalOpen, setIsCompetitionModalOpen] = useState(false);
    const [isPillarDiagnosisModalOpen, setIsPillarDiagnosisModalOpen] = useState(false);
    const [pillarToDiagnose, setPillarToDiagnose] = useState<{ id: string, name: string } | null>(null);
    const [pillarDiagnosisResult, setPillarDiagnosisResult] = useState<PillarDiagnosisResult | null>(null);
    const [isLoadingPillarDiagnosis, setIsLoadingPillarDiagnosis] = useState(false);
    const [recommendationToAssign, setRecommendationToAssign] = useState<Recommendation | null>(null);

    // State for Manager Matrix
    const [managersWithRiskProfiles, setManagersWithRiskProfiles] = useState<ManagerWithData[]>([]);
    const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);

    // Memoized Data Calculations
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


    // Handlers
    const handleGenerateAnalysis = async (type: 'current' | 'forecast') => {
        setIsAnalysisModalOpen(true);
        setIsLoadingAnalysis(true);
        setAnalysisError(null);
        setAnalysisResult(null);

        try {
            const promise = type === 'current'
                ? generateExecutiveAnalysis(managersForDisplay, currentTimePeriod)
                : generateExecutiveForecastAnalysis(managers, currentTimePeriod);
            
            toast.promise(promise, {
                loading: type === 'current' ? 'يقوم الذكاء الاصطناعي بتحليل الأداء الحالي...' : 'يقوم الذكاء الاصطناعي بالتنبؤ وتحليل المستقبل...',
                success: 'تم إنشاء التحليل بنجاح!',
                error: 'فشل إنشاء التحليل.',
            });
            const result = await promise;
            setAnalysisResult(result);
        } catch (e) {
            console.error(e);
            setAnalysisError("حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى لاحقًا.");
        } finally {
            setIsLoadingAnalysis(false);
        }
    };
    
    const handleGeneratePlan = async (recommendation: Recommendation) => {
        const { targetRole } = recommendation;
        const managersInRole = managers.filter(m => m.role === targetRole);

        if (managersInRole.length === 1) {
            // If only one manager, assign directly
            await handleAssignPlan(managersInRole[0].id, recommendation.text);
        } else {
             // If multiple or zero, open assignment modal
            setRecommendationToAssign(recommendation);
        }
    };
    
    const handleAssignPlan = async (managerId: string, recommendationText: string) => {
        if (!managerId) return;
        
        const toastId = toast.loading('يقوم الذكاء الاصطناعي بإنشاء خطة العمل...');
        
        try {
            const { steps } = await generateActionPlanSteps(recommendationText);
            dispatch({
                type: 'ADD_ACTION_PLAN',
                payload: { managerId, recommendation: recommendationText, steps }
            });
            toast.success('تم إنشاء وإسناد خطة العمل بنجاح!', { id: toastId });
            setRecommendationToAssign(null); // Close assignment modal
        } catch (e) {
            console.error(e);
            toast.error('فشل إنشاء خطة العمل.', { id: toastId });
        }
    };

    const handleDiagnosePillar = async (pillar: {id: string, name: string}) => {
        setIsPillarDiagnosisModalOpen(true);
        setIsLoadingPillarDiagnosis(true);
        setPillarToDiagnose(pillar);
        
        const managersDataForPillar = managersForDisplay.map(manager => {
            const managerPillar = manager.pillars.find(p => p.id === pillar.id);
            if (!managerPillar) return null;
            return {
                managerName: manager.name,
                kpiPerformances: managerPillar.kpis.map(kpi => ({
                    kpiName: kpi.name,
                    score: calculateKpiScore(kpi),
                })),
            };
        }).filter(m => m !== null);

        try {
            const result = await generatePillarDiagnosis(
                pillar.name, 
                pillarPerformance.find(p => p.id === pillar.id)?.score || 0,
                managersDataForPillar as any
            );
            setPillarDiagnosisResult(result);
        } catch (e) {
            console.error(e);
            toast.error('فشل تشخيص الركيزة.');
            setIsPillarDiagnosisModalOpen(false);
        } finally {
            setIsLoadingPillarDiagnosis(false);
        }
    };

    const handleDownloadReport = async () => {
        toast('جاري إعداد التقرير للتنزيل...', { icon: '⏳' });
        const reportElement = document.getElementById('executive-report-content');
        if (!reportElement) return;

        // Temporarily add a class to scale up for better quality
        reportElement.classList.add('print-quality');
        
        await delay(500); // allow styles to apply

        html2canvas(reportElement, {
            scale: 2, // Increase resolution
            useCORS: true,
            backgroundColor: '#0f172a' // slate-900
        }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jspdf.jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save(`Executive_Report_${new Date().toISOString().slice(0,10)}.pdf`);
            toast.success('تم تنزيل التقرير بنجاح!');
        }).catch(err => {
             console.error("PDF generation failed", err);
             toast.error("فشل إعداد التقرير.");
        }).finally(() => {
            // Clean up the class
            reportElement.classList.remove('print-quality');
        });
    };
    
    return (
        <div className="space-y-8">
            <style>{`
                .print-quality {
                    transform: scale(1.2);
                    transform-origin: top left;
                    width: 83.33% !important; /* 1 / 1.2 */
                }
            `}</style>
            
            {/* Tabs */}
            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-1.5 flex flex-wrap items-center gap-2">
                {(Object.entries({
                    overview: { label: 'نظرة عامة', icon: Squares2X2Icon },
                    matrix: { label: 'مصفوفة الأداء والمخاطر', icon: ShieldCheckIcon },
                    risk_assessment: { label: 'تقييم المخاطر الإجرائي', icon: BeakerIcon},
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
                    <div className="space-y-6 animate-fade-in">
                        {/* Header Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-slate-800 rounded-lg p-5 shadow-lg border border-slate-700">
                                <h4 className="text-slate-400 font-semibold mb-2">الأداء العام للمحطة</h4>
                                <p className="text-4xl font-bold text-cyan-400">{stationOverallScore}%</p>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-5 shadow-lg border border-slate-700">
                                <h4 className="text-slate-400 font-semibold mb-2">الركائز الأعلى أداءً</h4>
                                <p className="text-lg font-bold text-green-400 truncate">{pillarPerformance[0]?.name || 'N/A'}</p>
                                <span className="text-sm text-green-400/80">{pillarPerformance[0]?.score || 0}%</span>
                            </div>
                            <div className="bg-slate-800 rounded-lg p-5 shadow-lg border border-slate-700">
                                <h4 className="text-slate-400 font-semibold mb-2">الركائز الأقل أداءً</h4>
                                <p className="text-lg font-bold text-red-400 truncate">{pillarPerformance[pillarPerformance.length - 1]?.name || 'N/A'}</p>
                                <span className="text-sm text-red-400/80">{pillarPerformance[pillarPerformance.length - 1]?.score || 0}%</span>
                            </div>
                             <div className="bg-slate-800 rounded-lg p-5 shadow-lg border border-slate-700 flex flex-col justify-center">
                                <button onClick={() => setIsCompetitionModalOpen(true)} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600">
                                    <TrophyIcon className="h-5 w-5"/>
                                    مدير الشهر
                                </button>
                            </div>
                        </div>

                        <SmartSummaryCard stationScore={stationOverallScore} pillars={pillarPerformance} />
                        
                        {/* Pillars and Managers */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                             {/* Pillars */}
                            <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
                                <h3 className="text-xl font-bold text-slate-100 mb-4">أداء الركائز</h3>
                                <div className="space-y-3">
                                    {pillarPerformance.map(p => (
                                        <div key={p.id} className="flex items-center justify-between text-sm">
                                            <button onClick={() => handleDiagnosePillar(p)} className="font-semibold text-slate-300 hover:text-cyan-400 flex items-center gap-2">
                                                <DocumentMagnifyingGlassIcon className="h-4 w-4"/>
                                                {p.name}
                                            </button>
                                            <div className="flex items-center gap-2">
                                                <div className="w-32 bg-slate-700 rounded-full h-2"><div className="bg-cyan-500 h-2 rounded-full" style={{ width: `${p.score}%` }}></div></div>
                                                <span className="font-bold text-cyan-400 w-10 text-end">{p.score}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                             {/* Manager Performance */}
                             <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700 flex flex-col">
                                <h3 className="text-xl font-bold text-slate-100 mb-4 flex-shrink-0">أداء المدراء</h3>
                                <div className="space-y-2 overflow-y-auto max-h-[350px] pr-2">
                                    {managerPerformance.map(m => (
                                        <div key={m.id} className="flex justify-between items-center bg-slate-800/50 p-2 rounded-md">
                                            <p className="font-medium text-slate-300">{m.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-cyan-400">{m.score}%</span>
                                                <button onClick={() => onEditManager(m.id)} className="text-slate-500 hover:text-cyan-300" title="تعديل"><PencilSquareIcon className="h-4 w-4"/></button>
                                                <button onClick={() => onGenerateReport(m.id)} className="text-slate-500 hover:text-cyan-300" title="إنشاء تقرير"><DocumentTextIcon className="h-4 w-4"/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                         {/* KPI Rankings */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top KPIs */}
                            <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
                                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4"><ArrowTrendingUpIcon className="h-6 w-6 text-green-400"/>أفضل 5 مؤشرات أداء</h3>
                                <ul className="space-y-2">
                                    {kpiRanking.top.map(kpi => (
                                        <li key={kpi.id} className="flex justify-between text-sm items-center">
                                            <button onClick={() => setSelectedKpiForDrilldown(kpi)} className="text-slate-300 hover:text-cyan-400 text-right">{kpi.name}</button>
                                            <span className="font-bold text-green-400">{kpi.score}%</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            {/* Bottom KPIs */}
                            <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
                                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-4"><ArrowTrendingDownIcon className="h-6 w-6 text-red-400"/>أسوأ 5 مؤشرات أداء</h3>
                                <ul className="space-y-2">
                                    {kpiRanking.bottom.map(kpi => (
                                        <li key={kpi.id} className="flex justify-between text-sm items-center">
                                                <button onClick={() => setSelectedKpiForDrilldown(kpi)} className="text-slate-300 hover:text-cyan-400 text-right">{kpi.name}</button>
                                            <span className="font-bold text-red-400">{kpi.score}%</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        
                        <WhatIfSimulationCard managers={managersForDisplay} stationOverallScore={stationOverallScore} />

                         {/* AI Actions Card */}
                        <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
                            <h3 className="text-xl font-bold text-slate-100 mb-4 text-center">أدوات التحليل الاستراتيجي</h3>
                            <div className="flex flex-wrap justify-center items-center gap-4">
                                <button onClick={() => handleGenerateAnalysis('current')} disabled={isLoadingAnalysis} className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 disabled:bg-slate-600">
                                    {isLoadingAnalysis ? <Spinner className="h-5 w-5" /> : <SparklesIcon className="h-5 w-5" />}
                                    تحليل الأداء الحالي
                                </button>
                                    <button onClick={() => handleGenerateAnalysis('forecast')} disabled={isLoadingAnalysis} className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-800 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-700 disabled:bg-slate-600">
                                    {isLoadingAnalysis ? <Spinner className="h-5 w-5" /> : <CpuChipIcon className="h-5 w-5" />}
                                    توقعات وتحليل مستقبلي
                                </button>
                                    <button onClick={handleDownloadReport} className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-500">
                                    <ArrowDownTrayIcon className="h-5 w-5" />
                                    تنزيل التقرير (PDF)
                                </button>
                            </div>
                        </div>

                    </div>
                )}
                {currentTab === 'matrix' && <ManagerMatrix managersData={managersWithRiskProfiles} isLoading={isLoadingMatrix} />}
                {currentTab === 'risk_assessment' && <RiskAssessmentTab />}
                {currentTab === 'action_hub' && <ExecutiveActionHub managers={managers} />}
            </div>

            {/* Modals */}
            <AnalysisModal
                isOpen={isAnalysisModalOpen}
                onClose={() => setIsAnalysisModalOpen(false)}
                isLoading={isLoadingAnalysis}
                analysisResult={analysisResult}
                error={analysisError}
                title="التحليل الاستراتيجي والتوصيات"
                onGeneratePlan={handleGeneratePlan}
            />
            {selectedKpiForDrilldown && (
                <KpiDrilldownModal
                    isOpen={!!selectedKpiForDrilldown}
                    onClose={() => setSelectedKpiForDrilldown(null)}
                    kpi={selectedKpiForDrilldown}
                />
            )}
             <CompetitionModal
                isOpen={isCompetitionModalOpen}
                onClose={() => setIsCompetitionModalOpen(false)}
            />
             {pillarToDiagnose && (
                <PillarDiagnosisModal
                    isOpen={isPillarDiagnosisModalOpen}
                    onClose={() => setIsPillarDiagnosisModalOpen(false)}
                    isLoading={isLoadingPillarDiagnosis}
                    result={pillarDiagnosisResult}
                    pillarName={pillarToDiagnose.name}
                    onGeneratePlan={handleGeneratePlan}
                />
            )}
             <AssignPlanToManagerModal
                isOpen={!!recommendationToAssign}
                onClose={() => setRecommendationToAssign(null)}
                onAssign={handleAssignPlan}
                recommendation={recommendationToAssign}
                managers={managers}
            />
        </div>
    );
};