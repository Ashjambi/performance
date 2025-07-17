import React, { useState, useEffect, useRef } from 'react';
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid';
import { CalculatorIcon, ArrowTrendingUpIcon, CpuChipIcon, DocumentMagnifyingGlassIcon, AcademicCapIcon } from '@heroicons/react/24/outline';

type KpiCardActionsProps = {
    onHowToCalculate: () => void;
    onTrend: () => void;
    onForecast: () => void;
    onRca?: () => void; // Optional RCA handler
    onTrainingScenario: () => void;
};

export const KpiCardActions = ({ onHowToCalculate, onTrend, onForecast, onRca, onTrainingScenario }: KpiCardActionsProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Handle clicks outside the component to close the menu
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);
    
    const handleActionClick = (action: () => void) => {
        action();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(prev => !prev)}
                className="p-1 rounded-full text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-label="خيارات إضافية للمؤشر"
            >
                <EllipsisVerticalIcon className="h-5 w-5" />
            </button>
            {isOpen && (
                <div
                    className="absolute end-0 mt-2 w-56 origin-top-right bg-slate-900 border border-slate-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20 animate-fade-in-down"
                    role="menu"
                    aria-orientation="vertical"
                >
                    <div className="py-1" role="none">
                        <button
                            onClick={() => handleActionClick(onHowToCalculate)}
                            className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
                            role="menuitem"
                        >
                            <CalculatorIcon className="h-5 w-5" />
                            <span>الحاسبة التفاعلية</span>
                        </button>
                        <button
                            onClick={() => handleActionClick(onTrend)}
                            className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
                            role="menuitem"
                        >
                            <ArrowTrendingUpIcon className="h-5 w-5" />
                            <span>الاتجاه التاريخي</span>
                        </button>
                         <button
                            onClick={() => handleActionClick(onForecast)}
                            className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
                            role="menuitem"
                        >
                            <CpuChipIcon className="h-5 w-5" />
                            <span>التنبؤ المستقبلي</span>
                        </button>
                         <button
                            onClick={() => handleActionClick(onTrainingScenario)}
                            className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-cyan-400"
                            role="menuitem"
                        >
                            <AcademicCapIcon className="h-5 w-5" />
                            <span>إنشاء سيناريو تدريبي</span>
                        </button>
                        {onRca && (
                            <>
                                <div className="my-1 h-px bg-slate-700" role="separator"></div>
                                <button
                                    onClick={() => handleActionClick(onRca)}
                                    className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-yellow-400 hover:bg-slate-800"
                                    role="menuitem"
                                >
                                    <DocumentMagnifyingGlassIcon className="h-5 w-5" />
                                    <span>تشخيص السبب الجذري</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
            <style>{`
                @keyframes fade-in-down {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-down { animation: fade-in-down 0.2s ease-out forwards; }
            `}</style>
        </div>
    );
};