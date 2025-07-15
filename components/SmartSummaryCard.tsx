


import React, { useState, useEffect, useContext } from 'react';
import { toast } from 'react-hot-toast';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { Spinner } from './Spinner.tsx';
import { generateSmartSummary } from '../services/geminiService.tsx';
import { AppStateContext } from '../context/AppContext.tsx';

type SmartSummaryCardProps = {
    stationScore: number;
    pillars: { name: string; score: number }[];
};

export const SmartSummaryCard = ({ stationScore, pillars }: SmartSummaryCardProps) => {
    const { currentTimePeriod } = useContext(AppStateContext);
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            setIsLoading(true);
            try {
                const result = await generateSmartSummary(stationScore, pillars, currentTimePeriod);
                setSummary(result.summary);
            } catch (error) {
                console.error("Failed to generate smart summary:", error);
                setSummary("تعذر إنشاء الملخص الذكي. يرجى المحاولة مرة أخرى.");
            } finally {
                setIsLoading(false);
            }
        };

        if (stationScore > 0 && pillars.length > 0) {
            fetchSummary();
        } else {
            setIsLoading(false);
            setSummary("لا توجد بيانات كافية لإنشاء ملخص.");
        }
    }, [stationScore, pillars, currentTimePeriod]);

    return (
        <div className="bg-slate-800/50 rounded-lg shadow-lg p-4 border border-slate-700 flex items-center gap-4">
            <div className="p-2 bg-cyan-500/20 rounded-full">
                <SparklesIcon className="h-6 w-6 text-cyan-400" />
            </div>
            <div className="flex-grow">
                <h3 className="font-bold text-slate-200">الملخص الذكي</h3>
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Spinner className="h-4 w-4" />
                        <span>جاري إنشاء الملخص...</span>
                    </div>
                ) : (
                    <p className="text-slate-300 text-sm">{summary}</p>
                )}
            </div>
        </div>
    );
};