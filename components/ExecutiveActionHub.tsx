import React, { useState, useMemo } from 'react';
import type { Manager, ActionPlan } from '../data.js';
import { ClipboardDocumentCheckIcon, FunnelIcon, UserCircleIcon, ClockIcon } from '@heroicons/react/24/solid';

type FilterStatus = 'all' | 'in_progress' | 'completed';

export const ExecutiveActionHub = ({ managers }: { managers: Manager[] }) => {
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('in_progress');
    const [filterManagerId, setFilterManagerId] = useState<string>('all');

    const allActionPlans = useMemo(() => {
        return managers.flatMap(manager => 
            manager.actionPlans.map(plan => ({
                ...plan,
                managerName: manager.name,
                managerId: manager.id,
            }))
        ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [managers]);

    const filteredPlans = useMemo(() => {
        return allActionPlans.filter(plan => {
            const isCompleted = plan.steps.every(s => s.isCompleted);
            
            const statusMatch = 
                filterStatus === 'all' ||
                (filterStatus === 'completed' && isCompleted) ||
                (filterStatus === 'in_progress' && !isCompleted);
            
            const managerMatch = filterManagerId === 'all' || plan.managerId === filterManagerId;

            return statusMatch && managerMatch;
        });
    }, [allActionPlans, filterStatus, filterManagerId]);
    
    const PlanCard = ({ plan }) => {
        const completedSteps = plan.steps.filter(s => s.isCompleted).length;
        const totalSteps = plan.steps.length;
        const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
        const isCompleted = completedSteps === totalSteps;
        const hasOverdueStep = plan.steps.some(s => s.dueDate && !s.isCompleted && new Date() > new Date(s.dueDate));

        return (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
                <div className="flex justify-between items-start gap-3">
                    <div className="flex-grow">
                         <p className="font-semibold text-slate-200">{plan.originalRecommendation}</p>
                         <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                            <div className="flex items-center gap-1.5"><UserCircleIcon className="h-4 w-4"/><span>{plan.managerName}</span></div>
                            <div className="flex items-center gap-1.5"><ClockIcon className="h-4 w-4"/><span>{new Date(plan.createdAt).toLocaleDateString('ar-EG')}</span></div>
                         </div>
                    </div>
                    {hasOverdueStep && !isCompleted && <span className="flex-shrink-0 text-xs bg-red-500 text-white px-2 py-1 rounded-full font-bold">متأخرة</span>}
                    {isCompleted && <span className="flex-shrink-0 text-xs bg-green-500 text-white px-2 py-1 rounded-full font-bold">مكتملة</span>}
                </div>
                 <div className="mt-3">
                    <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                        <span>التقدم</span>
                        <span>{completedSteps}/{totalSteps}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all duration-500 ${isCompleted ? 'bg-green-500' : 'bg-cyan-500'}`} style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
            <h2 className="text-xl font-bold text-slate-100 mb-4">مركز متابعة خطط العمل</h2>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700 mb-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                    <FunnelIcon className="h-5 w-5 text-slate-400"/>
                    <span>تصفية حسب:</span>
                </div>
                {/* Status Filter */}
                <div className="flex items-center bg-slate-800 p-1 rounded-md">
                    <button onClick={() => setFilterStatus('in_progress')} className={`px-3 py-1 text-sm rounded ${filterStatus === 'in_progress' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>قيد التنفيذ</button>
                    <button onClick={() => setFilterStatus('completed')} className={`px-3 py-1 text-sm rounded ${filterStatus === 'completed' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>مكتملة</button>
                    <button onClick={() => setFilterStatus('all')} className={`px-3 py-1 text-sm rounded ${filterStatus === 'all' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>الكل</button>
                </div>
                 {/* Manager Filter */}
                <div>
                     <select 
                        value={filterManagerId} 
                        onChange={e => setFilterManagerId(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white text-sm rounded-md py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                        <option value="all">كل المدراء</option>
                        {managers.map(manager => (
                            <option key={manager.id} value={manager.id}>{manager.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Plans List */}
            <div className="space-y-4">
                {filteredPlans.length > 0 ? (
                    filteredPlans.map(plan => <PlanCard key={plan.id} plan={plan} />)
                ) : (
                    <div className="text-center py-16 px-6 bg-slate-800/50 rounded-lg border border-dashed border-slate-700">
                        <ClipboardDocumentCheckIcon className="mx-auto h-12 w-12 text-slate-600" />
                        <h3 className="mt-2 text-xl font-semibold text-white">لا توجد خطط عمل تطابق هذه التصفية</h3>
                        <p className="mt-1 text-sm text-slate-400">
                            جرب تغيير معايير التصفية أو قم بإنشاء خطط عمل جديدة.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};