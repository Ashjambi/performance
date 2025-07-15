
import React from 'react';
import { toast } from 'react-hot-toast';
import { ShieldCheckIcon, UserGroupIcon, StarIcon, ExclamationTriangleIcon, AcademicCapIcon, ArrowUpRightIcon } from '@heroicons/react/24/solid';
import type { ManagerWithData } from '../data.js';
import { Spinner } from './Spinner.js';

type ManagerMatrixProps = {
    managersData: ManagerWithData[];
    isLoading: boolean;
};

const Quadrant = ({ title, icon: Icon, managers, bgColor, iconColor }) => (
    <div className={`rounded-lg p-4 ${bgColor} border border-slate-700 h-full flex flex-col`}>
        <h3 className={`font-bold text-slate-100 flex items-center gap-2 mb-3`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
            {title}
        </h3>
        <div className="space-y-2 flex-grow">
            {managers.length > 0 ? managers.map(manager => (
                <div key={manager.id} className="group relative bg-slate-800/70 p-2 rounded-md">
                    <p className="text-sm font-semibold text-slate-200">{manager.name}</p>
                     <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-60 p-3 bg-slate-950 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-600">
                        <p className="font-bold text-cyan-400 mb-1">الأداء: {manager.score}%</p>
                        <p className="font-bold text-yellow-400 mb-1">المخاطر: {manager.riskProfile?.profile || 'غير محدد'}</p>
                        <hr className="border-slate-700 my-1"/>
                        <p>{manager.riskProfile?.reasoning || 'تعذر تحميل ملف المخاطر.'}</p>
                    </div>
                </div>
            )) : <p className="text-sm text-slate-500 text-center pt-4">لا يوجد مدراء في هذا التصنيف</p>}
        </div>
    </div>
);

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