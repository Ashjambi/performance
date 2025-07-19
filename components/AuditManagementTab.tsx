import React, { useState, useContext } from 'react';
import { toast } from 'react-hot-toast';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.tsx';
import { ClipboardDocumentListIcon, SparklesIcon, PlusCircleIcon, PencilIcon, CheckCircleIcon, XCircleIcon, MinusCircleIcon, DocumentIcon, PrinterIcon } from '@heroicons/react/24/solid';
import { Spinner } from './Spinner.tsx';
import { generateAuditChecklist, API_KEY_ERROR_MESSAGE, isAiAvailable } from '../services/geminiService.tsx';
import type { AuditChecklist, AuditChecklistItem, AuditChecklistItemStatus, IdentifiedRisk, AuditRiskLevel } from '../data.tsx';

const RISK_LEVEL_STYLES: Record<AuditRiskLevel, string> = {
    'High': 'bg-red-500/20 text-red-400 border-red-500/30',
    'Medium': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'Low': 'bg-green-500/20 text-green-400 border-green-500/30',
};
const RISK_LEVEL_TRANSLATION: Record<AuditRiskLevel, string> = {
    'High': 'مخاطرة عالية',
    'Medium': 'مخاطرة متوسطة',
    'Low': 'مخاطرة منخفضة',
};

const AuditManagementTab = () => {
    const { audits } = useContext(AppStateContext);
    const dispatch = useContext(AppDispatchContext);

    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedAudit, setSelectedAudit] = useState<AuditChecklist | null>(null);

    const handleGenerateChecklist = async () => {
        if (!prompt.trim()) {
            toast.error('يرجى إدخال وصف لقائمة التدقيق المطلوبة.');
            return;
        }
        setIsLoading(true);
        const toastId = toast.loading('يقوم الذكاء الاصطناعي بإنشاء قائمة التدقيق...');

        try {
            const checklist = await generateAuditChecklist(prompt);
            dispatch({ type: 'ADD_AUDIT_CHECKLIST', payload: { prompt, checklist } });
            toast.success('تم إنشاء قائمة التدقيق بنجاح!', { id: toastId });
            setPrompt('');
        } catch (e: any) {
            console.error(e);
            toast.error(e.message === API_KEY_ERROR_MESSAGE ? API_KEY_ERROR_MESSAGE : 'فشل في إنشاء قائمة التدقيق.', { id: toastId });
        } finally {
            setIsLoading(false);
        }
    };

    const handleStatusChange = (itemId: string, status: AuditChecklistItemStatus) => {
        if (!selectedAudit) return;
        dispatch({
            type: 'UPDATE_AUDIT_ITEM_STATUS',
            payload: { checklistId: selectedAudit.id, itemId, status },
        });
    };

    const handleNotesChange = (itemId: string, notes: string) => {
        if (!selectedAudit) return;
        dispatch({
            type: 'UPDATE_AUDIT_ITEM_NOTES',
            payload: { checklistId: selectedAudit.id, itemId, notes },
        });
    };

    const handleConvertToRisk = (item: AuditChecklistItem) => {
        const risk: IdentifiedRisk = {
            risk_title: `وجود خلل في: ${item.text}`,
            risk_description: `تم اكتشاف هذا الخلل أثناء تدقيق "${selectedAudit?.title}". ملاحظات المدقق: ${item.notes || 'لا يوجد'}`,
            category: 'التشغيل',
            likelihood: 'محتمل',
            impact: 'متوسط',
        };

        dispatch({
            type: 'ADD_TO_RISK_REGISTER',
            payload: { risk, source: `تدقيق: ${selectedAudit?.title}` }
        });

        toast.success(`تم تحويل "${item.text}" إلى مخاطرة في سجل المخاطر.`);
    };
    
    const handlePrint = () => {
        const printContents = document.getElementById('printable-audit-checklist')?.innerHTML;
        const originalContents = document.body.innerHTML;
        if (printContents) {
            document.body.innerHTML = `
            <html>
                <head>
                <title>طباعة قائمة التدقيق</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Cairo', sans-serif; direction: rtl; margin: 1.5rem; }
                    @page { size: A4; margin: 1in; }
                    .print-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #ccc; padding-bottom: 1rem; margin-bottom: 1.5rem; }
                    h3 { font-size: 1.6rem; font-weight: bold; color: #000; margin: 0; }
                    h4 { font-size: 1.3rem; font-weight: bold; color: #333; margin-top: 2rem; margin-bottom: 1rem; background-color: #f3f4f6; padding: 0.5rem; border-radius: 0.25rem; }
                    .print-item { page-break-inside: avoid; margin-bottom: 1.5rem; border: 1px solid #eee; padding: 1rem; border-radius: 0.5rem; }
                    .item-text { font-size: 1rem; margin-bottom: 0.5rem; display: block; font-weight: 500;}
                    .item-risk-level { font-size: 0.9rem; margin-bottom: 1rem; font-weight: bold; }
                    .status-options { display: flex; gap: 2rem; margin-top: 1rem; align-items: center; }
                    .status-options span { display: inline-block; font-size: 0.9rem; }
                    .checkbox { display: inline-block; width: 1.1rem; height: 1.1rem; border: 1px solid #333; border-radius: 0.25rem; vertical-align: middle; margin-left: 0.5rem; }
                    .notes-section { margin-top: 1rem; }
                    .notes-label { font-weight: bold; font-size: 0.9rem; }
                    .notes-lines { border-bottom: 1px dotted #888; height: 1.5rem; margin-top: 0.5rem; }
                </style>
                </head>
                <body>
                ${printContents}
                </body>
            </html>
            `;
            window.print();
            document.body.innerHTML = originalContents;
            window.location.reload();
        }
    };


    // Update selectedAudit with the latest state from context
    React.useEffect(() => {
        if (selectedAudit) {
            const updatedAudit = audits.find(a => a.id === selectedAudit.id);
            setSelectedAudit(updatedAudit || null);
        }
    }, [audits, selectedAudit]);

    const renderAuditDetails = (audit: AuditChecklist) => {
        const itemsByCategory = audit.items.reduce((acc, item) => {
            (acc[item.category] = acc[item.category] || []).push(item);
            return acc;
        }, {} as Record<string, AuditChecklistItem[]>);

        return (
            <div className="p-4 bg-slate-900 rounded-lg animate-fade-in-up">
                {/* Screen Header */}
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-cyan-400">{audit.title}</h3>
                    <button
                        onClick={handlePrint}
                        className="p-2 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        title="طباعة القائمة"
                    >
                        <PrinterIcon className="h-5 w-5" />
                    </button>
                </div>
                <p className="text-xs text-slate-500 mb-4">تم إنشاؤها في: {new Date(audit.createdAt).toLocaleString('ar-EG')}</p>

                 {/* Hidden Div for Printing */}
                <div id="printable-audit-checklist" className="hidden">
                    <div className="print-header">
                        <div>
                            <h3>قائمة تدقيق</h3>
                            <p>{audit.title}</p>
                        </div>
                        <div>
                            <p><strong>تاريخ التدقيق:</strong> ____ / ____ / ______</p>
                            <p><strong>اسم المدقق:</strong> _______________________</p>
                        </div>
                    </div>
                    {Object.entries(itemsByCategory).map(([category, items]) => (
                        <div key={category}>
                            <h4>{category}</h4>
                            {items.map((item, index) => (
                                <div key={item.id} className="print-item">
                                    <span className="item-text">{index + 1}. {item.text}</span>
                                    <p className="item-risk-level">مستوى المخاطرة: {RISK_LEVEL_TRANSLATION[item.riskLevel]}</p>
                                    <div className="status-options">
                                        <span><span className="checkbox"></span> متوافق</span>
                                        <span><span className="checkbox"></span> غير متوافق</span>
                                        <span><span className="checkbox"></span> ملاحظة</span>
                                    </div>
                                    <div className="notes-section">
                                        <p className="notes-label">الملاحظات:</p>
                                        <div className="notes-lines"></div>
                                        <div className="notes-lines"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>


                {/* Interactive UI for the app screen */}
                <div className="space-y-4">
                    {Object.entries(itemsByCategory).map(([category, items]) => (
                        <div key={category}>
                            <h4 className="font-bold text-slate-300 mb-2">{category}</h4>
                            <div className="space-y-3">
                                {items.map(item => (
                                    <div key={item.id} className="bg-slate-800 p-3 rounded-md border border-slate-700">
                                        <div className="flex justify-between items-start gap-2 mb-3">
                                            <p className="text-slate-200 flex-grow">{item.text}</p>
                                            <span className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full border ${RISK_LEVEL_STYLES[item.riskLevel]}`}>
                                                {RISK_LEVEL_TRANSLATION[item.riskLevel]}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <RadioOption item={item} status="compliant" label="متوافق" icon={CheckCircleIcon} color="text-green-500" onChange={handleStatusChange} />
                                                <RadioOption item={item} status="non-compliant" label="غير متوافق" icon={XCircleIcon} color="text-red-500" onChange={handleStatusChange} />
                                                <RadioOption item={item} status="note" label="ملاحظة" icon={PencilIcon} color="text-yellow-500" onChange={handleStatusChange} />
                                            </div>
                                            {item.status === 'non-compliant' && (
                                                <button onClick={() => handleConvertToRisk(item)} className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                                                    <PlusCircleIcon className="h-5 w-5" />
                                                    تحويل إلى مخاطرة
                                                </button>
                                            )}
                                        </div>
                                        {(item.status === 'non-compliant' || item.status === 'note') && (
                                            <textarea
                                                value={item.notes}
                                                onChange={e => handleNotesChange(item.id, e.target.value)}
                                                placeholder="أضف ملاحظاتك هنا..."
                                                rows={2}
                                                className="w-full bg-slate-700 text-white p-2 rounded-md mt-3 text-sm border border-slate-600 focus:ring-cyan-500"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const RadioOption = ({ item, status, label, icon: Icon, color, onChange }) => (
        <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name={`status-${item.id}`} checked={item.status === status} onChange={() => onChange(item.id, status)} className="hidden" />
            <Icon className={`h-6 w-6 transition-colors ${item.status === status ? color : 'text-slate-500'}`} />
            <span className={`transition-colors text-sm ${item.status === status ? 'text-white font-semibold' : 'text-slate-400'}`}>{label}</span>
        </label>
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
                 <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
                    <h2 className="text-xl font-bold text-slate-100 mb-4">إنشاء قائمة تدقيق</h2>
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="مثال: أنشئ لي قائمة تدقيق لعملية دفع الطائرة للخلف بناءً على معايير ISAGO..."
                        rows={4}
                        className="w-full bg-slate-700 text-white p-2 rounded-md border border-slate-600 focus:ring-cyan-500"
                    />
                    <button
                        onClick={handleGenerateChecklist}
                        disabled={isLoading || !isAiAvailable}
                        title={!isAiAvailable ? API_KEY_ERROR_MESSAGE : undefined}
                        className="w-full mt-3 inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 disabled:bg-slate-600"
                    >
                        {isLoading ? <Spinner className="h-5 w-5" /> : <SparklesIcon className="h-5 w-5" />}
                        إنشاء بالذكاء الاصطناعي
                    </button>
                </div>
                <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
                     <h2 className="text-xl font-bold text-slate-100 mb-4">قوائم التدقيق المحفوظة</h2>
                     <div className="space-y-2 max-h-96 overflow-y-auto">
                        {audits.length > 0 ? audits.map(audit => (
                            <button
                                key={audit.id}
                                onClick={() => setSelectedAudit(audit)}
                                className={`w-full text-right p-3 rounded-md transition-colors flex items-start gap-3 ${selectedAudit?.id === audit.id ? 'bg-cyan-500/20 border border-cyan-500' : 'bg-slate-700/50 hover:bg-slate-700'}`}
                            >
                               <DocumentIcon className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5"/>
                               <div>
                                 <p className="font-semibold text-slate-100">{audit.title}</p>
                                 <p className="text-xs text-slate-400">{new Date(audit.createdAt).toLocaleDateString('ar-EG')}</p>
                               </div>
                            </button>
                        )) : (
                            <p className="text-sm text-slate-500 text-center py-4">لم يتم إنشاء قوائم بعد.</p>
                        )}
                     </div>
                </div>
            </div>
            <div className="lg:col-span-2">
                {selectedAudit ? renderAuditDetails(selectedAudit) : (
                     <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-700">
                        <ClipboardDocumentListIcon className="h-16 w-16 text-slate-600" />
                        <h3 className="mt-4 text-xl font-bold text-white">اختر أو أنشئ قائمة تدقيق</h3>
                        <p className="mt-1 text-slate-400">ابدأ بإنشاء قائمة تدقيق جديدة باستخدام الذكاء الاصطناعي، أو اختر واحدة من القائمة لعرضها وبدء عملية التدقيق.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditManagementTab;