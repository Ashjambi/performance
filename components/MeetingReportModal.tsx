

import React, { useState, useEffect, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/solid';
import { DocumentTextIcon, ChartBarIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { Manager } from '../data.tsx';
import { calculateManagerOverallScore, calculatePillarScore } from '../data.tsx';
import { generateMeetingSummary, API_KEY_ERROR_MESSAGE } from '../services/geminiService.tsx';
import { Spinner } from './Spinner.tsx';
import { AppStateContext } from '../context/AppContext.tsx';

type MeetingReportModalProps = {
    isOpen: boolean;
    onClose: () => void;
    manager: Manager | null;
};

export const MeetingReportModal = ({ isOpen, onClose, manager }: MeetingReportModalProps) => {
    const { currentTimePeriod } = useContext(AppStateContext);
    const [summary, setSummary] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (isOpen && manager) {
            setIsLoading(true);
            generateMeetingSummary(manager, currentTimePeriod)
                .then(result => setSummary(result.summary))
                .catch(err => {
                    console.error(err);
                    const errorMessage = err.message === API_KEY_ERROR_MESSAGE ? API_KEY_ERROR_MESSAGE : "تعذر إنشاء ملخص بالذكاء الاصطناعي.";
                    setSummary(errorMessage);
                })
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, manager, currentTimePeriod]);

    if (!isOpen || !manager) return null;

    const overallScore = calculateManagerOverallScore(manager.pillars);
    const openActionPlans = manager.actionPlans.filter(p => p.steps.some(s => !s.isCompleted));
    
    const pillarData = manager.pillars.map(p => ({
        name: p.name,
        score: calculatePillarScore(p),
        fullMark: 100,
    }));

    const handlePrint = () => {
        window.print();
    };

    const getScoreColor = (score) => score >= 90 ? '#4ade80' : score >= 75 ? '#facc15' : '#f87171';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60] no-print" onClick={onClose}>
            <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col scale-95 animate-scale-in" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <DocumentTextIcon className="h-6 w-6 text-cyan-400" />
                        تقرير أداء للمدير
                    </h2>
                    <div>
                        <button onClick={handlePrint} className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors me-2" aria-label="طباعة">
                            <PrinterIcon className="h-5 w-5" />
                        </button>
                        <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
                    </div>
                </header>

                <div id="printable-report" className="p-6 overflow-y-auto text-slate-300 bg-slate-900 printable-area">
                    <div className="report-header mb-6 text-center">
                        <h1 className="text-3xl font-bold text-white">تقرير مراجعة الأداء</h1>
                        <p className="text-slate-400">الفترة: {new Date().toLocaleString('ar-EG', { month: 'long', year: 'numeric' })}</p>
                    </div>

                    {/* Manager Info */}
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-slate-800 rounded-lg">
                        <div><strong className="text-slate-400 block">الاسم:</strong> <span className="text-slate-200">{manager.name}</span></div>
                        <div><strong className="text-slate-400 block">القسم:</strong> <span className="text-slate-200">{manager.department}</span></div>
                        <div className="text-center bg-slate-900 p-2 rounded-md">
                            <strong className="text-slate-400 block">الأداء العام</strong>
                            <span className="text-3xl font-bold" style={{ color: getScoreColor(overallScore) }}>{overallScore}%</span>
                        </div>
                    </div>

                    {/* AI Summary */}
                    <div className="mb-6 p-4 bg-slate-800 rounded-lg">
                        <h2 className="text-lg font-bold text-cyan-400 mb-2">ملخص الأداء بالذكاء الاصطناعي</h2>
                        {isLoading ? <Spinner className=""/> : 
                            <div className="prose prose-sm prose-invert prose-p:my-1 text-slate-300">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
                            </div>
                        }
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Pillars Chart */}
                        <div className="p-4 bg-slate-800 rounded-lg">
                            <h2 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2"><ChartBarIcon className="h-5 w-5"/>أداء الركائز</h2>
                            <div className="h-64 w-full">
                                <ResponsiveContainer>
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={pillarData}>
                                        <PolarGrid stroke="#374151" />
                                        <PolarAngleAxis dataKey="name" tick={{ fill: '#d1d5db', fontSize: 11, fontFamily: 'Cairo' }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1e293b',
                                                border: '1px solid #334155',
                                                borderRadius: '0.5rem',
                                                fontFamily: 'Cairo'
                                            }}
                                            labelStyle={{
                                                color: '#ffffff',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                        <Radar name={manager.name} dataKey="score" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.6} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Action Plans */}
                        <div className="p-4 bg-slate-800 rounded-lg">
                             <h2 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2"><ClipboardDocumentCheckIcon className="h-5 w-5"/>خطط العمل المفتوحة ({openActionPlans.length})</h2>
                             {openActionPlans.length > 0 ? (
                                <ul className="space-y-2 text-sm overflow-y-auto max-h-52 pr-2">
                                    {openActionPlans.map(plan => (
                                        <li key={plan.id} className="p-2 bg-slate-900 rounded-md">&bull; {plan.originalRecommendation}</li>
                                    ))}
                                </ul>
                             ) : (
                                <p className="text-slate-500 text-center pt-10">لا توجد خطط عمل مفتوحة حالياً.</p>
                             )}
                        </div>
                    </div>

                </div>
                
                 <style>{`
                    @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
                    .prose-invert { --tw-prose-body: #d1d5db; --tw-prose-headings: #ffffff; --tw-prose-links: #38bdf8; --tw-prose-bold: #ffffff; }
                    .recharts-polar-angle-axis-tick-value tspan {
                        font-family: 'Cairo', sans-serif !important;
                    }
                    
                    @media print {
                      body {
                        background-color: #fff !important;
                      }
                      .no-print { display: none !important; }
                      .printable-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        padding: 20px;
                        background-color: #ffffff !important;
                        color: #000000 !important;
                        --tw-prose-body: #374151;
                        --tw-prose-headings: #111827;
                      }
                      .printable-area .bg-slate-800, .printable-area .bg-slate-900 {
                          background-color: #f3f4f6 !important; /* gray-100 */
                          border: 1px solid #e5e7eb !important; /* gray-200 */
                      }
                       .printable-area .text-white, .printable-area .text-slate-200, .printable-area .text-slate-300 { color: #1f2937 !important; /* gray-800 */ }
                       .printable-area .text-slate-400 { color: #4b5563 !important; /* gray-600 */ }
                       .printable-area .text-cyan-400 { color: #0891b2 !important; /* cyan-600 */}
                       .recharts-wrapper .recharts-surface, .recharts-wrapper .recharts-surface * {
                           fill: #000 !important;
                           stroke: #374151 !important;
                       }
                       .recharts-wrapper .recharts-polar-grid-concentric-polygon {
                           stroke: #e5e7eb !important;
                       }
                       .recharts-wrapper .recharts-radar, .recharts-wrapper .recharts-radar-polygon {
                            stroke: #0891b2 !important;
                            fill: #0891b2 !important;
                       }
                       .recharts-wrapper .recharts-polar-angle-axis-tick-value tspan {
                            fill: #374151 !important;
                       }
                    }
                `}</style>
            </div>
        </div>
    );
};