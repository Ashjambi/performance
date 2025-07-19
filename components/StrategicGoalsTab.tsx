import React, { useState, useContext, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.tsx';
import type { StrategicGoal, KPI } from '../data.tsx';
import { calculateKpiScore, ALL_KPIS, KPI_CATEGORIES } from '../data.tsx';
import { TrophyIcon, PlusCircleIcon, XMarkIcon, PencilIcon, TrashIcon, SparklesIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import { Spinner } from './Spinner.tsx';
import { generateStrategicGoal, API_KEY_ERROR_MESSAGE, isAiAvailable } from '../services/geminiService.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';


const GoalModal = ({ isOpen, onClose, goal, onSave }) => {
    const [formData, setFormData] = useState(goal || { title: '', description: '', timeframe: 'quarterly', linkedKpiIds: [] });
    const [aiIdea, setAiIdea] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleKpiLink = (kpiId) => {
        const newLinkedKpis = formData.linkedKpiIds.includes(kpiId)
            ? formData.linkedKpiIds.filter(id => id !== kpiId)
            : [...formData.linkedKpiIds, kpiId];
        handleInputChange('linkedKpiIds', newLinkedKpis);
    };

    const handleSuggest = async () => {
        if (!aiIdea.trim()) {
            toast.error("يرجى إدخال فكرة أولية للهدف.");
            return;
        }
        setIsSuggesting(true);
        try {
            const suggestion = await generateStrategicGoal(aiIdea);
            setFormData(prev => ({
                ...prev,
                title: suggestion.title,
                description: suggestion.description,
                timeframe: suggestion.timeframe,
                linkedKpiIds: suggestion.linkedKpiIds,
            }));
            toast.success("تم إنشاء الاقتراح بنجاح!");
        } catch (e) {
            toast.error("فشل في إنشاء اقتراح.");
            console.error(e);
        } finally {
            setIsSuggesting(false);
        }
    };
    
    const handleSave = () => {
        if (formData.title.trim() && formData.linkedKpiIds.length > 0) {
            onSave(formData);
            onClose();
        } else {
            toast.error("يجب إدخال عنوان للهدف وربط مؤشر أداء واحد على الأقل.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" onClick={onClose}>
            <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h2 className="text-xl font-bold text-white">{goal ? 'تعديل الهدف الاستراتيجي' : 'إضافة هدف استراتيجي جديد'}</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700"><XMarkIcon className="h-6 w-6" /></button>
                </header>
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-3">
                        <h3 className="font-semibold text-cyan-400">اقتراح بالذكاء الاصطناعي</h3>
                        <textarea
                            value={aiIdea}
                            onChange={e => setAiIdea(e.target.value)}
                            placeholder="اكتب فكرة عامة عن الهدف هنا (مثال: أن نكون الأفضل في خدمة العملاء)..."
                            rows={2}
                            className="w-full bg-slate-700 text-white p-2 rounded-md border border-slate-600 focus:ring-cyan-500"
                        />
                        <button onClick={handleSuggest} disabled={isSuggesting || !isAiAvailable} className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 disabled:bg-slate-600">
                            {isSuggesting ? <Spinner className="h-5 w-5"/> : <SparklesIcon className="h-5 w-5" />}
                            {isSuggesting ? 'جاري الاقتراح...' : 'اقتراح هدف ذكي'}
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">عنوان الهدف</label>
                        <input type="text" value={formData.title} onChange={e => handleInputChange('title', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">الوصف</label>
                        <textarea rows={3} value={formData.description} onChange={e => handleInputChange('description', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">الإطار الزمني</label>
                        <select value={formData.timeframe} onChange={e => handleInputChange('timeframe', e.target.value)} className="w-full bg-slate-700 p-2 rounded-md border border-slate-600">
                            <option value="quarterly">ربع سنوي</option>
                            <option value="yearly">سنوي</option>
                        </select>
                    </div>

                    <div>
                        <h3 className="text-lg font-semibold text-slate-300 mb-2">ربط مؤشرات الأداء الرئيسية</h3>
                        <div className="space-y-3 max-h-60 overflow-y-auto p-2 bg-slate-900/50 rounded-md">
                            {Object.entries(KPI_CATEGORIES).map(([category, kpiIds]) => (
                                <details key={category} open>
                                    <summary className="font-bold text-cyan-400 cursor-pointer flex items-center gap-2">
                                        <ChevronDownIcon className="h-4 w-4 details-arrow" />
                                        {category}
                                    </summary>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 pr-4">
                                        {kpiIds.map(kpiId => (
                                            <label key={kpiId} className="flex items-center gap-2 p-2 bg-slate-800 rounded-md cursor-pointer">
                                                <input type="checkbox" checked={formData.linkedKpiIds.includes(kpiId)} onChange={() => handleKpiLink(kpiId)} className="h-4 w-4 rounded bg-slate-700 text-cyan-500 border-slate-600 focus:ring-cyan-500"/>
                                                <span className="text-sm text-slate-300">{ALL_KPIS[kpiId]?.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </details>
                            ))}
                        </div>
                    </div>
                </div>
                <footer className="p-4 border-t border-slate-700 flex justify-end gap-3">
                    <button onClick={onClose} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg">إلغاء</button>
                    <button onClick={handleSave} className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-4 py-2 rounded-lg">حفظ الهدف</button>
                </footer>
            </div>
        </div>
    );
};

const GoalCard = ({ goal, onEdit, onDelete }) => {
    const { managers } = useContext(AppStateContext);

    const progress = useMemo(() => {
        const relevantKpiScores: number[] = [];
        managers.forEach(manager => {
            manager.pillars.forEach(pillar => {
                pillar.kpis.forEach(kpi => {
                    if (goal.linkedKpiIds.includes(kpi.id)) {
                        relevantKpiScores.push(calculateKpiScore(kpi));
                    }
                });
            });
        });
        if (relevantKpiScores.length === 0) return 0;
        const totalScore = relevantKpiScores.reduce((sum, score) => sum + score, 0);
        return Math.round(totalScore / relevantKpiScores.length);
    }, [managers, goal.linkedKpiIds]);

    const getProgressColor = (p: number) => p >= 90 ? 'bg-green-500' : p >= 75 ? 'bg-yellow-500' : 'bg-red-500';

    return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex justify-between items-start gap-3">
                <div className="flex-grow">
                    <h4 className="font-bold text-slate-100">{goal.title}</h4>
                    <span className="text-xs bg-cyan-900 text-cyan-300 px-2 py-0.5 rounded-full">{goal.timeframe === 'quarterly' ? 'ربع سنوي' : 'سنوي'}</span>
                    <p className="text-sm text-slate-400 mt-2">{goal.description}</p>
                </div>
                <div className="flex-shrink-0 flex gap-2">
                    <button onClick={() => onEdit(goal)} className="text-slate-500 hover:text-cyan-400"><PencilIcon className="h-5 w-5" /></button>
                    <button onClick={() => onDelete(goal.id)} className="text-slate-500 hover:text-red-400"><TrashIcon className="h-5 w-5" /></button>
                </div>
            </div>
            <div className="mt-4">
                <div className="flex justify-between items-baseline mb-1">
                    <span className="text-sm font-semibold text-slate-300">التقدم المحرز</span>
                    <span className="text-xl font-bold text-cyan-400">{progress}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${getProgressColor(progress)}`} style={{ width: `${progress}%` }}></div>
                </div>
            </div>
        </div>
    );
};


const StrategicGoalsTab = () => {
    const { strategicGoals } = useContext(AppStateContext);
    const dispatch = useContext(AppDispatchContext);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<StrategicGoal | null>(null);
    const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

    const handleAdd = () => {
        setEditingGoal(null);
        setIsModalOpen(true);
    };

    const handleEdit = (goal: StrategicGoal) => {
        setEditingGoal(goal);
        setIsModalOpen(true);
    };
    
    const handleDelete = () => {
        if (deletingGoalId) {
            dispatch({ type: 'DELETE_STRATEGIC_GOAL', payload: deletingGoalId });
            toast.error("تم حذف الهدف الاستراتيجي.");
            setDeletingGoalId(null);
        }
    };

    const handleSave = (goalData) => {
        if (goalData.id) {
            dispatch({ type: 'UPDATE_STRATEGIC_GOAL', payload: goalData });
            toast.success("تم تحديث الهدف بنجاح.");
        } else {
            dispatch({ type: 'ADD_STRATEGIC_GOAL', payload: goalData });
            toast.success("تمت إضافة الهدف بنجاح.");
        }
    };

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                            <TrophyIcon className="h-6 w-6 text-cyan-400" />
                            الأهداف الاستراتيجية (OKRs)
                        </h2>
                        <p className="text-sm text-slate-400">تتبع الأهداف العليا للشركة وراقب التقدم المحرز فيها.</p>
                    </div>
                    <button onClick={handleAdd} className="inline-flex items-center gap-2 px-3 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600">
                        <PlusCircleIcon className="h-5 w-5" />
                        إضافة هدف جديد
                    </button>
                </div>

                {strategicGoals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {strategicGoals.map(goal => (
                            <GoalCard key={goal.id} goal={goal} onEdit={handleEdit} onDelete={setDeletingGoalId} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 px-6 bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-700">
                        <TrophyIcon className="mx-auto h-12 w-12 text-slate-600" />
                        <h3 className="mt-2 text-xl font-semibold text-white">لا توجد أهداف استراتيجية بعد</h3>
                        <p className="mt-1 text-sm text-slate-400">
                           ابدأ بإضافة هدفك الاستراتيجي الأول لربط الأداء التشغيلي برؤية الشركة.
                        </p>
                    </div>
                )}
            </div>

            <GoalModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                goal={editingGoal}
                onSave={handleSave}
            />
            
            <ConfirmDeleteModal
                isOpen={!!deletingGoalId}
                onClose={() => setDeletingGoalId(null)}
                onConfirm={handleDelete}
                title="تأكيد حذف الهدف"
                message="هل أنت متأكد من رغبتك في حذف هذا الهدف الاستراتيجي؟"
            />
        </>
    );
};

export default StrategicGoalsTab;
