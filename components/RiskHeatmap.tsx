import React, { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { Spinner } from './Spinner.tsx';
import type { RegisteredRisk } from '../data.tsx';
import { LIKELIHOOD_ORDER, IMPACT_ORDER } from '../data.tsx';
import { RiskCellDetailModal } from './RiskCellDetailModal.tsx';
import { generateHeatmapAnalysis, isAiAvailable, API_KEY_ERROR_MESSAGE } from '../services/geminiService.tsx';

type RiskHeatmapProps = {
    risks: RegisteredRisk[];
};

const RISK_COLORS = [
    ['bg-green-500/20', 'bg-green-500/30', 'bg-yellow-500/30', 'bg-orange-500/30', 'bg-orange-500/40'],
    ['bg-green-500/30', 'bg-yellow-500/30', 'bg-yellow-500/40', 'bg-orange-500/40', 'bg-red-500/40'],
    ['bg-yellow-500/30', 'bg-yellow-500/40', 'bg-orange-500/40', 'bg-red-500/40', 'bg-red-500/50'],
    ['bg-orange-500/30', 'bg-orange-500/40', 'bg-red-500/40', 'bg-red-500/50', 'bg-red-500/60'],
    ['bg-orange-500/40', 'bg-red-500/40', 'bg-red-500/50', 'bg-red-500/60', 'bg-red-500/70']
];

export const RiskHeatmap = ({ risks }: RiskHeatmapProps) => {
    const [selectedCell, setSelectedCell] = useState<{ risks: RegisteredRisk[], title: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<{ summary: string; priority_risks: any[] } | null>(null);

    const riskMatrix = useMemo(() => {
        const matrix = Array(IMPACT_ORDER.length).fill(null).map(() => Array(LIKELIHOOD_ORDER.length).fill(null).map(() => []));
        risks.forEach(risk => {
            const impactIndex = IMPACT_ORDER.indexOf(risk.impact);
            const likelihoodIndex = LIKELIHOOD_ORDER.indexOf(risk.likelihood);
            if (impactIndex !== -1 && likelihoodIndex !== -1) {
                matrix[impactIndex][likelihoodIndex].push(risk);
            }
        });
        return matrix;
    }, [risks]);

    const handleCellClick = (impactIndex: number, likelihoodIndex: number) => {
        const cellRisks = riskMatrix[impactIndex][likelihoodIndex];
        if (cellRisks.length > 0) {
            const title = `المخاطر (${IMPACT_ORDER[impactIndex]} / ${LIKELIHOOD_ORDER[likelihoodIndex]})`;
            setSelectedCell({ risks: cellRisks, title });
        }
    };

    const handleAnalyze = async () => {
        setIsLoading(true);
        setAnalysisResult(null);
        const toastId = toast.loading('يقوم الذكاء الاصطناعي بتحليل الخريطة...');
        try {
            const result = await generateHeatmapAnalysis(risks);
            setAnalysisResult(result);
            toast.success('اكتمل تحليل الخريطة الحرارية!', { id: toastId });
        } catch(e: any) {
            toast.error(e.message === API_KEY_ERROR_MESSAGE ? API_KEY_ERROR_MESSAGE : 'فشل تحليل الخريطة.', { id: toastId });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <>
            <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="flex-grow w-full">
                    <div className="grid grid-cols-6 gap-1 text-white">
                        {/* Corner empty cell */}
                        <div className="p-2"></div>
                        {/* Likelihood headers */}
                        {LIKELIHOOD_ORDER.map(l => (
                            <div key={l} className="text-center font-bold text-xs p-2 text-slate-300">{l}</div>
                        ))}

                        {/* Impact headers and cells */}
                        {IMPACT_ORDER.map((impact, impactIndex) => (
                            <React.Fragment key={impact}>
                                <div className="flex items-center justify-center font-bold text-xs text-slate-300 p-2 transform -rotate-90 h-24">
                                    <span className="whitespace-nowrap">{impact}</span>
                                </div>
                                {LIKELIHOOD_ORDER.map((likelihood, likelihoodIndex) => {
                                    const cellRisks = riskMatrix[impactIndex][likelihoodIndex];
                                    const bgColor = RISK_COLORS[impactIndex][likelihoodIndex];
                                    return (
                                        <div
                                            key={`${impact}-${likelihood}`}
                                            onClick={() => handleCellClick(impactIndex, likelihoodIndex)}
                                            className={`h-24 flex items-center justify-center rounded-md border border-slate-700 transition-transform hover:scale-105 ${cellRisks.length > 0 ? 'cursor-pointer' : 'cursor-default'} ${bgColor}`}
                                        >
                                            <span className="text-3xl font-black">{cellRisks.length}</span>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                <div className="w-full md:w-80 flex-shrink-0 space-y-4">
                     <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !isAiAvailable || risks.length === 0}
                        title={!isAiAvailable ? API_KEY_ERROR_MESSAGE : undefined}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 disabled:bg-slate-600"
                    >
                        {isLoading ? <Spinner className="h-5 w-5" /> : <SparklesIcon className="h-5 w-5" />}
                        تحليل الخريطة بالذكاء الاصطناعي
                    </button>

                    {analysisResult && (
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 animate-fade-in-up">
                            <h4 className="font-bold text-cyan-400 mb-2">ملخص التحليل:</h4>
                            <p className="text-sm text-slate-300 mb-4">{analysisResult.summary}</p>
                            <h4 className="font-bold text-orange-400 mb-2">المخاطر ذات الأولوية:</h4>
                            <ul className="space-y-2">
                                {analysisResult.priority_risks.map((risk, i) => (
                                    <li key={i} className="text-sm">
                                        <strong className="text-slate-200">{risk.risk_title}</strong>
                                        <p className="text-xs text-slate-400">{risk.reasoning}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <RiskCellDetailModal
                isOpen={!!selectedCell}
                onClose={() => setSelectedCell(null)}
                risks={selectedCell?.risks || []}
                title={selectedCell?.title || ''}
            />
        </>
    );
};