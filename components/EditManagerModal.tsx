

import React, { useState, useEffect, useMemo, useContext } from 'react';
import { XMarkIcon, TrashIcon, PlusCircleIcon } from '@heroicons/react/24/solid';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import type { Manager, ManagerRole, ManagerRoleValue, Pillar, KPI } from '../data.tsx';
import { ROLE_TEMPLATES, ALL_KPIS, ALL_PILLARS_MASTER_LIST, KPI_CATEGORIES, deepCopy, RISK_KPI_IDS } from '../data.tsx';
import { AppDispatchContext } from '../context/AppContext.tsx';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';
import { generateKpiTargetSuggestion } from '../services/geminiService.tsx';
import { Spinner } from './Spinner.tsx';

type EditManagerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  manager: Manager;
  roles: Record<ManagerRole, ManagerRoleValue>;
};

const PILLAR_ICONS = ['ChartBarIcon', 'ShieldCheckIcon', 'BanknotesIcon', 'UserGroupIcon', 'HeartIcon', 'ArchiveBoxIcon'];
const KPI_UNITS: Record<KPI['unit'], string> = {
    percentage: 'نسبة مئوية (%)',
    minutes: 'دقائق',
    per_1000_pax: 'لكل 1000 راكب',
    per_1000_mov: 'لكل 1000 حركة',
    incidents: 'حوادث',
    score: 'نقاط',
    currency: 'عملة (ر.س)',
    days: 'أيام',
};

const getSimpleUnitLabel = (unit: KPI['unit']): string => {
    switch (unit) {
        case 'percentage': return '%';
        case 'minutes': return 'دقيقة';
        case 'per_1000_pax': return 'لكل ١٠٠٠ راكب';
        case 'per_1000_mov': return 'لكل ١٠٠٠ حركة';
        case 'incidents': return 'حادثة';
        case 'score': return 'نقطة';
        case 'currency': return 'ر.س';
        case 'days': return 'أيام';
        default: return '';
    }
};

export const EditManagerModal = ({ isOpen, onClose, manager, roles }: EditManagerModalProps) => {
  const dispatch = useContext(AppDispatchContext);
  const [editableManager, setEditableManager] = useState<Manager | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [suggestingForKpi, setSuggestingForKpi] = useState<string | null>(null);
  const [suggestionResult, setSuggestionResult] = useState<{ kpiId: string; reasoning: string; target: number } | null>(null);

  // State for adding from templates
  const [showAddPillarUI, setShowAddPillarUI] = useState(false);
  const [selectedPillarToAdd, setSelectedPillarToAdd] = useState('');
  const [addingKpiState, setAddingKpiState] = useState<{ pillarId: string | null; selectValue: string }>({ pillarId: null, selectValue: '' });

  // State for creating custom items
  const [isCreatingCustomPillar, setIsCreatingCustomPillar] = useState(false);
  const [newPillarData, setNewPillarData] = useState({ name: '', weight: '10', iconName: 'ChartBarIcon' });
  
  const initialKpiData = {
    name: '',
    target: '',
    unit: 'percentage' as KPI['unit'],
    lowerIsBetter: false,
    tooltip: { description: '', dataSource: '', importance: '' }
  };
  const [creatingCustomKpi, setCreatingCustomKpi] = useState<{ pillarId: string | null }>({ pillarId: null });
  const [newKpiData, setNewKpiData] = useState(initialKpiData);


  useEffect(() => {
    if (isOpen && manager) {
      setEditableManager(deepCopy(manager));
    } else if (!isOpen) {
      // Reset all local state on close
      setEditableManager(null);
      setShowAddPillarUI(false);
      setSelectedPillarToAdd('');
      setAddingKpiState({ pillarId: null, selectValue: '' });
      setIsDeleteConfirmOpen(false);
      setIsCreatingCustomPillar(false);
      setNewPillarData({ name: '', weight: '10', iconName: 'ChartBarIcon' });
      setCreatingCustomKpi({ pillarId: null });
      setNewKpiData(initialKpiData);
      setSuggestingForKpi(null);
      setSuggestionResult(null);
    }
  }, [isOpen, manager]);

  const handleManagerChange = (field: keyof Manager, value: any) => {
    if (!editableManager) return;
    setEditableManager({ ...editableManager, [field]: value });
  };
  
  const handleRoleChange = (newRole: ManagerRole) => {
    if (!editableManager || newRole === editableManager.role) {
      return;
    }

    setEditableManager(prevManager => {
        if (!prevManager) return null; // Should not happen
        return {
            ...prevManager,
            role: newRole,
            pillars: deepCopy(ROLE_TEMPLATES[newRole]),
        };
    });

    toast("تم تحديث قالب الأداء بناءً على الدور الجديد.", {
        icon: 'ℹ️',
    });
  };
  
  const handlePillarWeightChange = (pillarId: string, value: string) => {
    if (!editableManager) return;
    const newPillars = editableManager.pillars.map(p => {
        if (p.id === pillarId) {
            const newWeight = parseInt(value, 10);
            return { ...p, weight: isNaN(newWeight) ? 0 : newWeight };
        }
        return p;
    });
    handleManagerChange('pillars', newPillars);
  };
  
  const handleRemovePillar = (pillarId: string) => {
    if (!editableManager) return;
    handleManagerChange('pillars', editableManager.pillars.filter(p => p.id !== pillarId));
  };

  const handleAddPillar = () => {
    if (!selectedPillarToAdd || !editableManager) return;
    const pillarToAdd = ALL_PILLARS_MASTER_LIST.find(p => p.id === selectedPillarToAdd);
    if (pillarToAdd && !editableManager.pillars.some(p => p.id === pillarToAdd.id)) {
      handleManagerChange('pillars', [...editableManager.pillars, deepCopy(pillarToAdd)]);
    }
    setSelectedPillarToAdd('');
    setShowAddPillarUI(false);
  };

  const handleCreateCustomPillar = () => {
    if (!newPillarData.name.trim() || !editableManager) {
        toast.error("يرجى إدخال اسم للركيزة المخصصة.");
        return;
    }
    const newPillar: Pillar = {
        id: `pillar_custom_${Date.now()}`,
        name: newPillarData.name.trim(),
        weight: parseInt(newPillarData.weight, 10) || 0,
        iconName: newPillarData.iconName as any,
        kpis: []
    };
    handleManagerChange('pillars', [...editableManager.pillars, newPillar]);
    setNewPillarData({ name: '', weight: '10', iconName: 'ChartBarIcon' });
    setIsCreatingCustomPillar(false);
    setShowAddPillarUI(false);
  };

  const handleKpiTargetChange = (pillarId: string, kpiId: string, value: string) => {
    if (!editableManager) return;

    const newPillars = editableManager.pillars.map(p => {
        if (p.id === pillarId) {
            const newKpis = p.kpis.map(k => {
                if (k.id === kpiId) {
                    const newTarget = parseFloat(value);
                    return { ...k, target: isNaN(newTarget) ? 0 : newTarget };
                }
                return k;
            });
            return { ...p, kpis: newKpis };
        }
        return p;
    });

    handleManagerChange('pillars', newPillars);
  };
  
  const handleSuggestKpiTarget = async (pillarId: string, kpi: KPI) => {
    if (!editableManager) return;
    setSuggestingForKpi(kpi.id);
    setSuggestionResult(null); // Clear previous suggestion
    const toastId = toast.loading(`جاري اقتراح هدف لـ "${kpi.name}"...`);
    try {
        const result = await generateKpiTargetSuggestion(kpi);
        handleKpiTargetChange(pillarId, kpi.id, String(result.suggested_target));
        setSuggestionResult({ kpiId: kpi.id, reasoning: result.reasoning, target: result.suggested_target });
        toast.success(`تم اقتراح هدف جديد: ${result.suggested_target}`, { id: toastId });
    } catch (e) {
        console.error(e);
        toast.error("فشل إنشاء اقتراح الهدف.", { id: toastId });
    } finally {
        setSuggestingForKpi(null);
    }
  };

  const handleRemoveKpi = (pillarId: string, kpiId: string) => {
    if (!editableManager) return;
    const newPillars = editableManager.pillars.map(p => {
      if (p.id === pillarId) {
        return { ...p, kpis: p.kpis.filter(k => k.id !== kpiId) };
      }
      return p;
    });
    handleManagerChange('pillars', newPillars);
  };

  const handleAddKpi = () => {
    if (!addingKpiState.selectValue || !addingKpiState.pillarId || !editableManager) return;
    const kpiMasterData = ALL_KPIS[addingKpiState.selectValue];
    if (!kpiMasterData) return;

    const history = [{ date: new Date().toISOString(), value: 0 }];
    const kpiToAdd: KPI = { 
        ...deepCopy(kpiMasterData), 
        id: addingKpiState.selectValue, 
        value: 0,
        history: history
    };

    const newPillars = editableManager.pillars.map(p => {
      if (p.id === addingKpiState.pillarId && !p.kpis.some(k => k.id === kpiToAdd.id)) {
        return { ...p, kpis: [...p.kpis, kpiToAdd] };
      }
      return p;
    });

    handleManagerChange('pillars', newPillars);
    setAddingKpiState({ pillarId: null, selectValue: '' });
  };
  
  const handleCreateCustomKpi = () => {
    if (!newKpiData.name.trim() || !newKpiData.target || !creatingCustomKpi.pillarId || !editableManager) {
        toast.error("يرجى ملء جميع حقول المؤشر المخصص (الاسم والهدف).");
        return;
    }

    const kpiToAdd: KPI = {
        id: `kpi_custom_${Date.now()}`,
        name: newKpiData.name.trim(),
        value: 0, // Default initial value
        target: parseFloat(newKpiData.target),
        unit: newKpiData.unit,
        lowerIsBetter: newKpiData.lowerIsBetter,
        tooltip: {
            description: newKpiData.tooltip.description.trim() || "مؤشر أداء مخصص.",
            dataSource: newKpiData.tooltip.dataSource.trim() || "إدخال يدوي.",
            importance: newKpiData.tooltip.importance.trim() || "مهم للتقييم.",
        },
        history: [{ date: new Date().toISOString(), value: 0 }],
    };
    
    const newPillars = editableManager.pillars.map(p => {
        if (p.id === creatingCustomKpi.pillarId) {
            return { ...p, kpis: [...p.kpis, kpiToAdd] };
        }
        return p;
    });

    handleManagerChange('pillars', newPillars);
    setCreatingCustomKpi({ pillarId: null });
    setNewKpiData(initialKpiData);
  };


  const handleSaveClick = () => {
    if (editableManager && editableManager.name.trim() && editableManager.department.trim() && totalWeight === 100) {
      dispatch({ type: 'UPDATE_MANAGER', payload: editableManager });
      toast.success(`تم حفظ تغييرات المدير "${editableManager.name}" بنجاح.`);
      onClose();
    } else {
        toast.error("يرجى التأكد من أن اسم المدير وقسمه غير فارغين وأن مجموع أوزان الركائز يساوي 100%.")
    }
  };
  
  const handleDeleteConfirm = () => {
    if (!manager) return;
    dispatch({ type: 'DELETE_MANAGER', payload: manager.id });
    toast.error(`تم حذف المدير "${manager.name}".`);
    setIsDeleteConfirmOpen(false);
    onClose();
  };

  const availablePillarsToAdd = useMemo(() => {
    if (!editableManager) return [];
    const currentPillarIds = new Set(editableManager.pillars.map(p => p.id));
    return ALL_PILLARS_MASTER_LIST.filter(p => !currentPillarIds.has(p.id));
  }, [editableManager]);
  
  const getAvailableKpisForPillar = (pillar: Pillar): { category: string; kpis: (Omit<KPI, 'value' | 'history'>)[] }[] => {
    if (!pillar) return [];
      
    const currentKpiIds = new Set(pillar.kpis.map(k => k.id));
    
    const categorizedKpis = Object.entries(KPI_CATEGORIES).map(([category, kpiIds]) => {
        const availableKpis = kpiIds
            .filter(id => !currentKpiIds.has(id))
            .map(id => ALL_KPIS[id])
            .filter(Boolean);
        
        return {
            category,
            kpis: availableKpis,
        };
    }).filter(group => group.kpis.length > 0);

    return categorizedKpis;
  };
  
  const totalWeight = useMemo(() => {
    if (!editableManager?.pillars) return 0;
    return editableManager.pillars.reduce((sum, p) => sum + (p.weight || 0), 0);
  }, [editableManager?.pillars]);


  if (!isOpen || !editableManager) return null;

  return (
    <>
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] flex flex-col transition-transform duration-300 scale-95 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">تعديل بيانات المدير</h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
        </header>

        <div className="flex-grow overflow-y-auto p-6 space-y-6 text-slate-300">
          {/* --- Basic Info --- */}
          <fieldset>
              <legend className="text-lg font-semibold text-cyan-400 mb-2">المعلومات الأساسية</legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label htmlFor="edit-manager-name" className="block text-sm font-medium text-slate-400 mb-2">اسم المدير</label>
                      <input id="edit-manager-name" type="text" value={editableManager.name} onChange={(e) => handleManagerChange('name', e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500" autoFocus />
                  </div>
                   <div>
                      <label htmlFor="edit-manager-department" className="block text-sm font-medium text-slate-400 mb-2">القسم</label>
                      <input id="edit-manager-department" type="text" value={editableManager.department} onChange={(e) => handleManagerChange('department', e.target.value)} className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                  </div>
                  <div className="md:col-span-2">
                      <label htmlFor="edit-manager-role" className="block text-sm font-medium text-slate-400 mb-2">الدور الوظيفي (يحدد مؤشرات الأداء)</label>
                      <select id="edit-manager-role" value={editableManager.role} onChange={(e) => handleRoleChange(e.target.value as ManagerRole)} className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500">
                          {(Object.keys(roles) as ManagerRole[]).map(roleKey => <option key={roleKey} value={roleKey}>{roles[roleKey]}</option>)}
                      </select>
                  </div>
              </div>
          </fieldset>

          {/* --- Pillars & KPIs Management --- */}
          <fieldset>
              <legend className="text-lg font-semibold text-cyan-400 mb-2">إدارة الركائز ومؤشرات الأداء</legend>
              <div className="space-y-4">
                  {editableManager.pillars.map(pillar => (
                      <div key={pillar.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                          <div className="flex justify-between items-center mb-3">
                              <h4 className="font-bold text-slate-100">{pillar.name}</h4>
                              <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1">
                                      <label htmlFor={`pillar-weight-${pillar.id}`} className="text-sm text-slate-400">الوزن</label>
                                      <input 
                                          type="number"
                                          id={`pillar-weight-${pillar.id}`}
                                          value={pillar.weight}
                                          onChange={(e) => handlePillarWeightChange(pillar.id, e.target.value)}
                                          className="w-16 bg-slate-700 border border-slate-600 text-white rounded-md p-1 text-center focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                          min="0"
                                          max="100"
                                      />
                                      <span className="text-sm text-slate-400">%</span>
                                  </div>
                                  <button type="button" onClick={() => handleRemovePillar(pillar.id)} className="text-slate-500 hover:text-red-400 transition-colors" title="إزالة الركيزة"><TrashIcon className="h-5 w-5"/></button>
                              </div>
                          </div>
                          <div className="space-y-2 pl-4 border-r-2 border-slate-700">
                              {pillar.kpis.map(kpi => (
                                <div key={kpi.id}>
                                  <div className="py-2 px-2 bg-slate-800 rounded-md">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-300 font-medium flex-grow">{kpi.name}</span>
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            <div className="flex items-center gap-2">
                                                <label htmlFor={`kpi-target-${kpi.id}`} className="text-xs text-slate-400">الهدف:</label>
                                                <input
                                                    type="number"
                                                    id={`kpi-target-${kpi.id}`}
                                                    value={kpi.target}
                                                    onChange={(e) => handleKpiTargetChange(pillar.id, kpi.id, e.target.value)}
                                                    className="w-20 bg-slate-700 border border-slate-600 text-white rounded-md p-1 text-center focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                                    step={kpi.unit === 'percentage' || kpi.unit === 'score' ? 1 : 0.1}
                                                />
                                                <span className="text-xs text-slate-400">{getSimpleUnitLabel(kpi.unit)}</span>
                                                  <button
                                                      type="button"
                                                      onClick={() => handleSuggestKpiTarget(pillar.id, kpi)}
                                                      disabled={suggestingForKpi === kpi.id}
                                                      className="text-slate-500 hover:text-cyan-400 disabled:text-cyan-600 disabled:animate-pulse p-1"
                                                      title="اقتراح هدف بالذكاء الاصطناعي"
                                                  >
                                                      {suggestingForKpi === kpi.id ? <Spinner className="h-4 w-4" /> : <SparklesIcon className="h-4 w-4"/>}
                                                  </button>
                                            </div>
                                            
                                            {kpi.benchmark && (
                                                <div className="flex items-center gap-2">
                                                    <label className="text-xs text-slate-400">النموذجي:</label>
                                                    <div className="relative group">
                                                        <div className="w-20 bg-slate-800 border border-dashed border-slate-600 text-slate-400 rounded-md p-1 text-center cursor-help">
                                                            {kpi.benchmark.target}
                                                        </div>
                                                        <div className="absolute bottom-full mb-2 end-0 w-max p-2 bg-slate-950 text-cyan-300 text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-slate-600">
                                                            المرجع: {kpi.benchmark.source}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <button type="button" onClick={() => handleRemoveKpi(pillar.id, kpi.id)} className="text-slate-500 hover:text-red-400 transition-colors" title="إزالة المؤشر"><TrashIcon className="h-4 w-4"/></button>
                                        </div>
                                    </div>
                                  </div>
                                  {suggestionResult && suggestionResult.kpiId === kpi.id && (
                                    <div className="mt-2 p-3 bg-cyan-900/50 border-l-4 border-cyan-500 text-sm text-slate-300 rounded animate-fade-in-down">
                                      <p className="font-semibold text-cyan-400 mb-1">💡 اقتراح الذكاء الاصطناعي:</p>
                                      <p>{suggestionResult.reasoning}</p>
                                    </div>
                                  )}
                                </div>
                              ))}
                               {/* --- Add KPI UI --- */}
                                {addingKpiState.pillarId === pillar.id ? (
                                    <div className="flex gap-2 mt-2 p-2 bg-slate-800 rounded-md">
                                        <select autoFocus value={addingKpiState.selectValue} onChange={(e) => setAddingKpiState({...addingKpiState, selectValue: e.target.value})} className="flex-grow bg-slate-700 border border-slate-600 text-white rounded-md py-1 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500">
                                            <option value="">اختر مؤشر...</option>
                                            {getAvailableKpisForPillar(pillar).map(group => (
                                                <optgroup key={group.category} label={group.category}>
                                                    {group.kpis.map(kpi => {
                                                        const isRisk = RISK_KPI_IDS.has(kpi.id);
                                                        return (
                                                            <option key={kpi.id} value={kpi.id} className={isRisk ? 'text-red-400 font-bold' : ''}>
                                                                {isRisk ? '⚠️ ' : ''}{kpi.name}
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            ))}
                                        </select>
                                        <button type="button" onClick={handleAddKpi} disabled={!addingKpiState.selectValue} className="bg-cyan-600 hover:bg-cyan-700 text-white px-2 py-1 rounded-md text-sm disabled:bg-slate-600">إضافة</button>
                                        <button type="button" onClick={() => setAddingKpiState({ pillarId: null, selectValue: '' })} className="text-slate-400 hover:text-white text-sm">إلغاء</button>
                                    </div>
                                ) : creatingCustomKpi.pillarId === pillar.id ? (
                                    <div className="mt-2 p-3 bg-slate-800 rounded-md border border-slate-600 space-y-3 animate-fade-in-down">
                                        <h5 className="font-semibold text-slate-300 text-sm">إنشاء مؤشر مخصص جديد</h5>
                                        <input type="text" placeholder="اسم المؤشر" value={newKpiData.name} onChange={e => setNewKpiData({...newKpiData, name: e.target.value})} className="w-full bg-slate-700 text-white text-sm p-2 rounded-md border border-slate-600" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <input type="number" placeholder="القيمة المستهدفة" value={newKpiData.target} onChange={e => setNewKpiData({...newKpiData, target: e.target.value})} className="w-full bg-slate-700 text-white text-sm p-2 rounded-md border border-slate-600" />
                                            <select value={newKpiData.unit} onChange={e => setNewKpiData({...newKpiData, unit: e.target.value as any})} className="w-full bg-slate-700 text-white text-sm p-2 rounded-md border border-slate-600">
                                                {Object.entries(KPI_UNITS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                                            </select>
                                        </div>
                                        <textarea placeholder="وصف المؤشر (Tooltip)" value={newKpiData.tooltip.description} onChange={e => setNewKpiData({...newKpiData, tooltip: {...newKpiData.tooltip, description: e.target.value}})} className="w-full bg-slate-700 text-white text-sm p-2 rounded-md border border-slate-600" rows={2}></textarea>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" id={`lowerIsBetter-${pillar.id}`} checked={newKpiData.lowerIsBetter} onChange={e => setNewKpiData({...newKpiData, lowerIsBetter: e.target.checked})} />
                                            <label htmlFor={`lowerIsBetter-${pillar.id}`} className="text-sm text-slate-400">القيمة الأقل هي الأفضل</label>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={handleCreateCustomKpi} className="bg-cyan-600 hover:bg-cyan-700 text-white px-2 py-1 rounded-md text-sm">حفظ المؤشر</button>
                                            <button type="button" onClick={() => setCreatingCustomKpi({ pillarId: null })} className="text-slate-400 hover:text-white text-sm">إلغاء</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-4 mt-2">
                                        <button type="button" onClick={() => setAddingKpiState({ pillarId: pillar.id, selectValue: '' })} className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"><PlusCircleIcon className="h-4 w-4"/>إضافة مؤشر</button>
                                        <button type="button" onClick={() => setCreatingCustomKpi({ pillarId: pillar.id })} className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"><PlusCircleIcon className="h-4 w-4"/>إضافة مؤشر مخصص</button>
                                    </div>
                                )}
                          </div>
                      </div>
                  ))}
                  
                  <div className={`mt-4 p-3 rounded-lg text-center font-bold transition-colors duration-300 ${totalWeight === 100 ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                      إجمالي الأوزان: {totalWeight}%
                      {totalWeight !== 100 && <p className="text-xs font-normal mt-1">يجب أن يكون المجموع 100% لحفظ التغييرات.</p>}
                  </div>

                  {/* --- Add Pillar UI --- */}
                   {showAddPillarUI ? (
                    <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-4">
                        {isCreatingCustomPillar ? (
                             <div className="space-y-3 animate-fade-in-down">
                                <h5 className="font-semibold text-slate-300 text-sm">إنشاء ركيزة مخصصة</h5>
                                <input type="text" placeholder="اسم الركيزة" value={newPillarData.name} onChange={e => setNewPillarData({...newPillarData, name: e.target.value})} className="w-full bg-slate-700 text-white text-sm p-2 rounded-md border border-slate-600" />
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" placeholder="الوزن (%)" value={newPillarData.weight} onChange={e => setNewPillarData({...newPillarData, weight: e.target.value})} className="w-full bg-slate-700 text-white text-sm p-2 rounded-md border border-slate-600" />
                                    <select value={newPillarData.iconName} onChange={e => setNewPillarData({...newPillarData, iconName: e.target.value})} className="w-full bg-slate-700 text-white text-sm p-2 rounded-md border border-slate-600">
                                        {PILLAR_ICONS.map(icon => <option key={icon} value={icon}>{icon.replace('Icon', '')}</option>)}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={handleCreateCustomPillar} className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1 rounded-md text-sm">حفظ الركيزة</button>
                                    <button type="button" onClick={() => setIsCreatingCustomPillar(false)} className="text-slate-400 hover:text-white text-sm">إلغاء</button>
                                </div>
                             </div>
                        ) : (
                            <>
                                <div className="flex gap-2">
                                    <select autoFocus value={selectedPillarToAdd} onChange={(e) => setSelectedPillarToAdd(e.target.value)} className="flex-grow bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-cyan-500">
                                        <option value="">اختر ركيزة من القائمة...</option>
                                        {availablePillarsToAdd.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <button type="button" onClick={handleAddPillar} disabled={!selectedPillarToAdd} className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-md disabled:bg-slate-600">إضافة</button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <hr className="flex-grow border-slate-600"/>
                                    <span className="text-slate-500 text-xs">أو</span>
                                    <hr className="flex-grow border-slate-600"/>
                                </div>
                                <button type="button" onClick={() => setIsCreatingCustomPillar(true)} className="w-full text-center text-sm text-cyan-400 hover:text-cyan-300">إنشاء ركيزة مخصصة</button>
                            </>
                        )}
                        <button type="button" onClick={() => setShowAddPillarUI(false)} className="w-full mt-2 text-center text-sm text-slate-500 hover:text-slate-300">إغلاق</button>
                    </div>
                ) : (
                    <button type="button" onClick={() => setShowAddPillarUI(true)} className="w-full flex items-center justify-center gap-2 text-cyan-400 hover:text-cyan-300 mt-4 p-2 border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-lg transition-colors"><PlusCircleIcon className="h-5 w-5"/>إضافة ركيزة جديدة</button>
                )}
              </div>
          </fieldset>
        </div>

        <footer className="p-4 border-t border-slate-700 flex justify-between items-center flex-shrink-0 bg-slate-800 rounded-b-xl">
          <button type="button" onClick={() => setIsDeleteConfirmOpen(true)} className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors">
            <TrashIcon className="h-5 w-5" />
            حذف المدير
          </button>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors">إلغاء</button>
            <button type="button" onClick={handleSaveClick} disabled={!editableManager.name.trim() || !editableManager.department.trim() || totalWeight !== 100} className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed">حفظ التغييرات</button>
          </div>
        </footer>
      </div>
      <style>{`
        @keyframes scale-in { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
        @keyframes fade-in-down {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
      `}</style>
    </div>
    <ConfirmDeleteModal
      isOpen={isDeleteConfirmOpen}
      onClose={() => setIsDeleteConfirmOpen(false)}
      onConfirm={handleDeleteConfirm}
      title="تأكيد الحذف"
      message={`هل أنت متأكد من رغبتك في حذف المدير "${manager?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
    />
    </>
  );
};