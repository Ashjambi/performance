
import React, { useState, useMemo, useContext, useEffect } from 'react';
import { XMarkIcon, TrophyIcon } from '@heroicons/react/24/solid';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { AppStateContext } from '../context/AppContext.tsx';
import type { Manager } from '../data.tsx';
import { getAvailableMonthsForCompetition, calculateManagerScoreForMonth, getManagerSnapshotForMonth } from '../data.tsx';
import { generateCompetitionAnnouncement, generateWinnerAnalysis } from '../services/geminiService.tsx';
import { Spinner } from './Spinner.tsx';

type CompetitionResult = {
    name: string;
    score: number;
};

const Podium = ({ results }: { results: CompetitionResult[] }) => {
    const podiumOrder = [results[1], results[0], results[2]].filter(Boolean); // 2nd, 1st, 3rd
    const podiumHeights = ['h-24', 'h-32', 'h-20'];
    const podiumColors = ['bg-slate-500', 'bg-yellow-500', 'bg-orange-500'];
    const podiumRanks = ['2', '1', '3'];

    return (
         <div className="flex justify-center items-end gap-2 mt-8 animate-fade-in">
            {podiumOrder.map((result, index) => (
                <div key={result.name} className="text-center w-1/3">
                    <p className="font-bold text-white truncate">{result.name}</p>
                    <p className={`text-sm font-semibold`} style={{color: podiumColors[index]}}>{result.score}%</p>
                    <div 
                        className={`flex items-center justify-center rounded-t-lg text-white font-black text-3xl ${podiumColors[index]}`}
                        style={{ height: podiumHeights[index] }}
                    >
                        {podiumRanks[index]}
                    </div>
                </div>
            ))}
        </div>
    );
};

export const CompetitionModal = ({ isOpen, onClose }) => {
    const { managers } = useContext(AppStateContext);

    const [selectedMonth, setSelectedMonth] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const [podiumResults, setPodiumResults] = useState<CompetitionResult[] | null>(null);
    const [winnerSnapshot, setWinnerSnapshot] = useState<Manager | null>(null);
    const [winnerScore, setWinnerScore] = useState<number | null>(null);
    const [winnerAnalysis, setWinnerAnalysis] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState<string | null>(null);

    const availableMonths = useMemo(() => getAvailableMonthsForCompetition(managers), [managers]);

    const resetState = () => {
        setPodiumResults(null);
        setWinnerSnapshot(null);
        setWinnerScore(null);
        setWinnerAnalysis(null);
        setAnnouncement(null);
        setIsLoading(false);
    };

    const handleAnalyze = () => {
        if (!selectedMonth) {
            toast.error("يرجى اختيار شهر للمنافسة.");
            return;
        }
        setIsLoading(true);
        resetState();

        setTimeout(() => {
            const calculatedResults = managers.map(manager => {
                const score = calculateManagerScoreForMonth(manager, selectedMonth);
                return score !== null ? { name: manager.name, score, id: manager.id } : null;
            }).filter((r): r is (CompetitionResult & { id: string }) => r !== null);
            
            calculatedResults.sort((a, b) => b.score - a.score);
            
            if(calculatedResults.length === 0) {
                toast.error("لا توجد بيانات كافية للمنافسة في هذا الشهر.");
                setIsLoading(false);
                return;
            }
            
            setPodiumResults(calculatedResults);

            const winnerResult = calculatedResults[0];
            const winnerManager = managers.find(m => m.id === winnerResult.id);
            if (winnerManager) {
                const snapshot = getManagerSnapshotForMonth(winnerManager, selectedMonth);
                setWinnerSnapshot(snapshot);
                setWinnerScore(winnerResult.score);
            }
            setIsLoading(false);
        }, 500); 
    };
    
    const handleGenerateDetails = async () => {
        if (!winnerSnapshot || winnerScore === null) return;
        
        const monthLabel = availableMonths.find(m => m.value === selectedMonth)?.label || '';
        
        setIsLoading(true);
        setWinnerAnalysis(null);
        setAnnouncement(null);
        const toastId = toast.loading('يقوم الذكاء الاصطناعي بإعداد التحليل والإعلان...');

        try {
            const analysisResponse = await generateWinnerAnalysis(winnerSnapshot, winnerScore, monthLabel);
            setWinnerAnalysis(analysisResponse.analysis);
            
            const announcementResponse = await generateCompetitionAnnouncement(winnerSnapshot.name, winnerScore, monthLabel);
            setAnnouncement(announcementResponse.announcement);
            
            toast.success('تم إعداد التفاصيل بنجاح!', { id: toastId });
        } catch (e) {
            console.error(e);
            toast.error('فشل في إعداد التفاصيل.', { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };
    
     useEffect(() => {
        if (isOpen && availableMonths.length > 0) {
            setSelectedMonth(availableMonths[0].value);
        }
        if (!isOpen) {
            resetState();
        }
    }, [isOpen, availableMonths]);


    if (!isOpen) return null;

    const winner = podiumResults && podiumResults.length > 0 ? podiumResults[0] : null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
            <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg flex flex-col transition-transform duration-300 scale-95 animate-scale-in" onClick={(e) => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <TrophyIcon className="h-6 w-6 text-yellow-400" />
                        مدير الشهر
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
                </header>

                <div className="p-6 space-y-4 text-slate-300 overflow-y-auto">
                    {!podiumResults ? (
                        <>
                            <p className="text-slate-400">اختر الشهر لبدء تحليل الأداء وتحديد المدير الأفضل أداءً بناءً على النتائج المسجلة.</p>
                            <div>
                                <label htmlFor="month-select" className="block text-sm font-medium text-slate-400 mb-1">اختر الشهر</label>
                                <select 
                                    id="month-select"
                                    value={selectedMonth}
                                    onChange={e => setSelectedMonth(e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                >
                                    {availableMonths.map(month => (
                                        <option key={month.value} value={month.value}>{month.label}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            {winner ? (
                                <>
                                    <div className="text-center">
                                        <p className="text-slate-400">نتائج مدير الشهر لـ <span className="font-bold text-cyan-400">{availableMonths.find(m => m.value === selectedMonth)?.label}</span></p>
                                        <h3 className="text-2xl font-bold text-yellow-400 mt-2">الفائز هو {winner.name}!</h3>
                                        <Podium results={podiumResults} />
                                    </div>

                                    {(winnerAnalysis || announcement) && (
                                        <div className="mt-6 space-y-4 text-start animate-fade-in">
                                            {winnerAnalysis && (
                                                <div className="p-4 bg-slate-900/50 border border-cyan-500/30 rounded-lg">
                                                    <h4 className="font-bold text-cyan-400 mb-2">تحليل الأداء المتميز:</h4>
                                                    <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-200">{winnerAnalysis}</p>
                                                </div>
                                            )}
                                            {announcement && (
                                                <div className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
                                                    <h4 className="font-bold text-cyan-400 mb-2">مسودة إعلان الفوز:</h4>
                                                    <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-200">{announcement}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center">
                                     <p className="text-yellow-500">لا توجد نتائج لعرضها. قد يكون السبب عدم توفر بيانات كاملة للمدراء في هذا الشهر.</p>
                                </div>
                            )}
                        </>
                    )}

                    {isLoading && (
                        <div className="flex justify-center items-center gap-2 p-4">
                            <Spinner className="h-5 w-5" />
                            <span>جاري التحليل...</span>
                        </div>
                    )}
                </div>

                <footer className="p-4 border-t border-slate-700 flex justify-between items-center gap-3">
                    {podiumResults && winner ? (
                         <>
                            <button onClick={() => resetState()} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg">
                                العودة
                            </button>
                             <button onClick={handleGenerateDetails} disabled={isLoading || !!winnerAnalysis} className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-slate-600 disabled:opacity-50">
                                {isLoading ? <Spinner className="h-4 w-4" /> : <SparklesIcon className="h-5 w-5" />}
                                {isLoading ? 'جاري الإعداد...' : 'شرح الفوز وإعداد الإعلان'}
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg">إلغاء</button>
                            <button onClick={handleAnalyze} disabled={isLoading || !selectedMonth} className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-slate-600">
                                بدء التحليل
                            </button>
                        </>
                    )}
                </footer>
                 <style>{`
                    @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                    .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
                    @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                    .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                `}</style>
            </div>
        </div>
    );
};