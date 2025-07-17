

import React from 'react';
import { toast } from 'react-hot-toast';
import { ShieldCheckIcon, UserGroupIcon, StarIcon, ExclamationTriangleIcon, AcademicCapIcon, ArrowUpRightIcon } from '@heroicons/react/24/solid';
import type { ManagerWithData } from '../data.tsx';
import { Spinner } from './Spinner.tsx';

type ManagerMatrixProps = {
    managersData: ManagerWithData[];
    isLoading: boolean;
};

const Quadrant = ({ title, icon: Icon, managers, bgColor, iconColor }) => {
    const getScoreColor = (score: number) => {
        if (score >= 90) return { text: 'text-green-400', bg: 'bg-green-500' };
        if (score >= 75) return { text: 'text-yellow-400', bg: 'bg-yellow-500' };
        return { text: 'text-red-400', bg: 'bg-red-500' };
    };

    const getRiskColor = (riskLevel: 'Low' | 'Medium' | 'High' | undefined) => {
        switch (riskLevel) {
            case 'Low': return 'text-green-400';
            case 'Medium': return 'text-yellow-400';
            case 'High': return 'text-red-400';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className={`rounded-lg p-4 ${bgColor} border border-slate-700 h-full flex flex-col`}>
            <h3 className={`font-bold text-slate-100 flex items-center gap-2 mb-3`}>
                <Icon className={`h-6 w-6 ${iconColor}`} />
                {title}
            </h3>
            <div className="space-y-2 flex-grow">
                {managers.length > 0 ? managers.map(manager => {
                    const scoreStyle = getScoreColor(manager.score);
                    const riskStyle = manager.riskProfile ? getRiskColor(manager.riskProfile.risk_level) : 'text-slate-400';

                    return (
                        <div key={manager.id} className="group relative bg-slate-800/70 p-2 rounded-md cursor-pointer">
                            <p className="text-sm font-semibold text-slate-200 truncate">{manager.name}</p>
                            
                            {/* New Tooltip Card */}
                            <div 
                                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-72 
                                           bg-slate-900 rounded-lg shadow-2xl border border-slate-700
                                           opacity-0 group-hover:opacity-100 pointer-events-none 
                                           z-20 text-right transition-all duration-300 group-hover:mb-3 group-hover:-translate-y-1"
                            >
                                <div className="p-3 border-b border-slate-700 bg-slate-800/50 rounded-t-lg">
                                    <h4 className="font-bold text-white">{manager.name}</h4>
                                </div>
                                <div className="p-4 space-y-4">
                                    {/* Performance Score */}
                                    <div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-sm text-slate-400">مستوى الأداء</span>
                                            <span className={`text-2xl font-bold ${scoreStyle.text}`}>{manager.score}%</span>
                                        </div>
                                        <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                                            <div className={`h-1.5 rounded-full ${scoreStyle.bg}`} style={{ width: `${manager.score}%` }}></div>
                                        </div>
                                    </div>
                                    
                                    {/* Risk Profile */}
                                    {manager.riskProfile ? (
                                        <div>
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-sm text-slate-400">ملف المخاطر</span>
                                                <span className={`font-bold ${riskStyle}`}>{manager.riskProfile.profile}</span>
                                            </div>
                                            <div className="mt-2 text-xs text-slate-400 bg-slate-800 p-2 rounded-md border border-slate-700">
                                                {manager.riskProfile.reasoning}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <span className="text-sm text-slate-400">ملف المخاطر</span>
                                            <p className="text-xs text-slate-500 mt-1">لم يتم تحميل ملف المخاطر.</p>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute w-3 h-3 bg-slate-900 border-b border-r border-slate-700 transform rotate-45 -bottom-[7px] left-1/2 -translate-x-1/2"></div>
                            </div>
                        </div>
                    );
                }) : <p className="text-sm text-slate-500 text-center pt-4">لا يوجد مدراء في هذا التصنيف</p>}
            </div>
        </div>
    );
};

export const ManagerMatrix = ({ managersData, isLoading }: ManagerMatrixProps) => {

    const categorizedManagers = {
        stars: managersData.filter(m => m.score >= 90 && m.riskProfile?.risk_level === 'Low'),
        critical: managersData.filter(m => m.score < 90 && m.riskProfile?.risk_level === 'High'),
        talents: managersData.filter(m => m.score >= 90 && m.riskProfile?.risk_level !== 'Low'),
        development: managersData.filter(m => m.score < 90 && m.riskProfile?.risk_level !== 'High'),
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-16 bg-slate-800/50 rounded-lg">
                <Spinner className="" />
                <p className="text-slate-300">جاري تحليل ملفات المخاطر لجميع المدراء...</p>
                <p className="text-slate-500 text-sm">(قد يستغرق هذا بعض الوقت)</p>
            </div>
        )
    }

    return (
        <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
             <h2 className="text-xl font-bold text-slate-100 mb-1">مصفوفة الأداء والمخاطر</h2>
             <p className="text-sm text-slate-400 mb-4">تصنيف المدراء بناءً على نتائج الأداء وملف المخاطر (المستمد من مؤشرات السلامة والجودة) لتحديد أولويات الدعم والتطوير.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Quadrant title="أبطال الأداء" icon={StarIcon} managers={categorizedManagers.stars} bgColor="bg-green-500/10" iconColor="text-green-400" />
                <Quadrant title="الأداء المتميز" icon={AcademicCapIcon} managers={categorizedManagers.talents} bgColor="bg-cyan-500/10" iconColor="text-cyan-400" />
                <Quadrant title="مجال للتطوير" icon={ArrowUpRightIcon} managers={categorizedManagers.development} bgColor="bg-yellow-500/10" iconColor="text-yellow-400" />
                <Quadrant title="مناطق حرجة" icon={ExclamationTriangleIcon} managers={categorizedManagers.critical} bgColor="bg-red-500/10" iconColor="text-red-400" />
            </div>
        </div>
    );
};
