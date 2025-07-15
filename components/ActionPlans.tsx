import React, { useContext, useState } from 'react';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.js';
import type { ActionPlan, ActionStep, Comment } from '../data.js';
import { TrashIcon, ChevronDownIcon, CheckCircleIcon, UserCircleIcon, PaperAirplaneIcon, ClockIcon } from '@heroicons/react/24/solid';
import { ClipboardDocumentListIcon, PlusCircleIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { AddActionPlanModal } from './AddActionPlanModal.js';

const ActionPlanCard = ({ plan }: { plan: ActionPlan }) => {
    const { selectedManagerId } = useContext(AppStateContext);
    const dispatch = useContext(AppDispatchContext);
    const [isExpanded, setIsExpanded] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [assigneeInput, setAssigneeInput] = useState<{ [key: string]: string }>({});

    const completedSteps = plan.steps.filter(s => s.isCompleted).length;
    const totalSteps = plan.steps.length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    const isCompleted = completedSteps === totalSteps;

    const toggleStep = (stepId: string) => {
        if (!selectedManagerId) return;
        dispatch({ type: 'TOGGLE_ACTION_PLAN_STEP', payload: { managerId: selectedManagerId, planId: plan.id, stepId } });
    };

    const deletePlan = () => {
        if (!selectedManagerId) return;
        if(window.confirm('هل أنت متأكد من رغبتك في حذف خطة العمل هذه؟ لا يمكن التراجع عن هذا الإجراء.')) {
            dispatch({ type: 'DELETE_ACTION_PLAN', payload: { managerId: selectedManagerId, planId: plan.id } });
            toast.error('تم حذف خطة العمل.');
        }
    };

    const handleAddComment = () => {
        if (!selectedManagerId || !newComment.trim()) return;
        dispatch({
            type: 'ADD_ACTION_PLAN_COMMENT',
            payload: {
                managerId: selectedManagerId,
                planId: plan.id,
                commentText: newComment.trim(),
            }
        });
        setNewComment('');
    };
    
    const handleUpdateAssignee = (stepId: string, assignee: string) => {
        if (!selectedManagerId) return;
        dispatch({
            type: 'UPDATE_ACTION_STEP_ASSIGNEE',
            payload: {
                managerId: selectedManagerId,
                planId: plan.id,
                stepId,
                assignee,
            }
        });
        setAssigneeInput(prev => ({...prev, [stepId]: ''}));
    };

    return (
        <div className={`bg-slate-800 rounded-lg shadow-lg border ${isCompleted ? 'border-green-500/30' : 'border-slate-700'} overflow-hidden`}>
            <header 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex-grow">
                    <p className="font-bold text-slate-100">{plan.originalRecommendation}</p>
                    <p className="text-xs text-slate-400 mt-1">
                        تاريخ الإنشاء: {new Date(plan.createdAt).toLocaleDateString('ar-EG')}
                    </p>
                </div>
                <div className="flex items-center gap-4 ms-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${isCompleted ? 'text-green-400' : 'text-cyan-400'}`}>
                           {completedSteps}/{totalSteps}
                        </span>
                       {isCompleted && <CheckCircleIcon className="h-5 w-5 text-green-400" />}
                    </div>
                    <ChevronDownIcon className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </header>
            {isExpanded && (
                <div className="p-4 border-t border-slate-700/50">
                    <div className="w-full bg-slate-700 rounded-full h-2.5 mb-4">
                        <div 
                            className="bg-cyan-500 h-2.5 rounded-full transition-all duration-500" 
                            style={{width: `${progress}%`}}
                        ></div>
                    </div>
                    {/* Steps */}
                    <div className="space-y-3 mb-6">
                        {plan.steps.map(step => {
                             const isOverdue = step.dueDate && !step.isCompleted && new Date() > new Date(step.dueDate);
                             return (
                                <div key={step.id} className="flex flex-col bg-slate-900/40 p-3 rounded-md">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id={step.id}
                                            checked={step.isCompleted}
                                            onChange={() => toggleStep(step.id)}
                                            className="h-5 w-5 rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer flex-shrink-0"
                                        />
                                        <label htmlFor={step.id} className={`ms-3 text-slate-300 cursor-pointer ${step.isCompleted ? 'line-through text-slate-500' : ''}`}>
                                            {step.text}
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between gap-4 mt-2 ps-8 text-xs">
                                        <div className="flex items-center gap-2">
                                            <UserCircleIcon className="h-4 w-4 text-slate-500"/>
                                            <span className="text-slate-500">المسؤول:</span>
                                            {step.assignedTo ? (
                                                <span className="font-semibold text-slate-300">{step.assignedTo}</span>
                                            ) : (
                                                <input 
                                                   type="text"
                                                   placeholder="إسناد لشخص..."
                                                   value={assigneeInput[step.id] || ''}
                                                   onChange={(e) => setAssigneeInput(prev => ({...prev, [step.id]: e.target.value}))}
                                                   onKeyDown={(e) => {
                                                       if (e.key === 'Enter' && assigneeInput[step.id]) {
                                                           handleUpdateAssignee(step.id, assigneeInput[step.id]);
                                                       }
                                                   }}
                                                   className="bg-slate-700 text-white text-xs rounded px-2 py-0.5 border border-slate-600 focus:ring-cyan-500 focus:outline-none"
                                                />
                                            )}
                                        </div>
                                        {step.dueDate && (
                                            <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
                                                <ClockIcon className="h-4 w-4" />
                                                <span>تستحق في: {new Date(step.dueDate).toLocaleDateString('ar-EG')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Comments Section */}
                     <div className="space-y-4 pt-4 border-t border-slate-700">
                        <h4 className="font-semibold text-slate-300 flex items-center gap-2">
                           <ChatBubbleBottomCenterTextIcon className="h-5 w-5 text-slate-400"/>
                           مناقشات الخطة ({plan.comments.length})
                        </h4>
                        <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                            {plan.comments.map(comment => (
                                <div key={comment.id} className="bg-slate-900/50 p-2 rounded-md text-sm">
                                    <p className="text-slate-300">{comment.text}</p>
                                    <p className="text-xs text-slate-500 mt-1 text-end">
                                        - {comment.author}, {new Date(comment.createdAt).toLocaleString('ar-EG', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' })}
                                    </p>
                                </div>
                            ))}
                        </div>
                         <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleAddComment(); }}
                                placeholder="أضف تعليقًا..."
                                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <button onClick={handleAddComment} className="p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:bg-slate-600" disabled={!newComment.trim()}>
                                <PaperAirplaneIcon className="h-5 w-5"/>
                            </button>
                        </div>
                    </div>


                     <div className="text-end mt-6">
                        <button 
                            onClick={deletePlan} 
                            className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-400 font-semibold"
                        >
                            <TrashIcon className="h-4 w-4" />
                            حذف الخطة
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

export const ActionPlans = () => {
    const { managers, selectedManagerId } = useContext(AppStateContext);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const selectedManager = managers.find(m => m.id === selectedManagerId);
    
    if (!selectedManager) {
        return null;
    }

    const plans = selectedManager.actionPlans || [];
    
    return (
        <>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                    خطط العمل ({plans.length})
                </h2>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75 transition-all duration-300"
                >
                    <PlusCircleIcon className="h-5 w-5" />
                    <span>إضافة خطة يدوية</span>
                </button>
            </div>
            
            {plans.length === 0 ? (
                <div className="text-center py-16 px-6 bg-slate-800/50 rounded-lg border border-dashed border-slate-700">
                    <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-slate-600" />
                    <h3 className="mt-2 text-xl font-semibold text-white">لا توجد خطط عمل حالياً</h3>
                    <p className="mt-1 text-sm text-slate-400">
                        يمكنك إنشاء خطط عمل من خلال تحليل الأداء بالذكاء الاصطناعي أو إضافتها يدوياً.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {plans.map(plan => (
                        <ActionPlanCard key={plan.id} plan={plan} />
                    ))}
                </div>
            )}

            <AddActionPlanModal 
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
            />
        </>
    );
};