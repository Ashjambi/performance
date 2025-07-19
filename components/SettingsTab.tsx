import React, { useState, useContext } from 'react';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.tsx';
import { toast } from 'react-hot-toast';
import { ExclamationTriangleIcon, ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';

const SettingsTab = () => {
    const appState = useContext(AppStateContext);
    const dispatch = useContext(AppDispatchContext);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
    const [dataToImport, setDataToImport] = useState<any | null>(null);

    const handleResetConfirm = () => {
        dispatch({ type: 'RESET_ALL_HISTORY' });
        toast.success('تمت إعادة تعيين بيانات التطبيق إلى الحالة الافتراضية.');
        setIsResetConfirmOpen(false);
    };
    
    const handleExport = () => {
        try {
            const dataToSave = {
                managers: appState.managers,
                riskRegister: appState.riskRegister,
                audits: appState.audits,
                strategicGoals: appState.strategicGoals
            };
            const jsonString = JSON.stringify(dataToSave, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const date = new Date().toISOString().slice(0, 10);
            a.download = `sgs_dashboard_backup_${date}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('تم تصدير البيانات بنجاح.');
        } catch (error) {
            console.error("Export failed:", error);
            toast.error("فشل تصدير البيانات.");
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parsedData = JSON.parse(text);

                if (parsedData && Array.isArray(parsedData.managers)) {
                    setDataToImport(parsedData);
                    setIsImportConfirmOpen(true);
                } else {
                    toast.error('ملف غير صالح. تأكد من أنه ملف نسخ احتياطي صحيح.');
                }
            } catch (error) {
                toast.error('فشل في قراءة الملف. تأكد من أنه ملف JSON صالح.');
            } finally {
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    };
    
    const handleImportConfirm = () => {
        if (!dataToImport) return;

        const newState = {
            ...appState,
            managers: dataToImport.managers || [],
            riskRegister: dataToImport.riskRegister || [],
            audits: dataToImport.audits || [],
            strategicGoals: dataToImport.strategicGoals || [],
            selectedManagerId: dataToImport.managers?.[0]?.id || null,
        };

        dispatch({ type: 'SET_STATE', payload: newState });

        toast.success('تم استيراد البيانات بنجاح. سيتم تحديث التطبيق.');
        setIsImportConfirmOpen(false);
        setDataToImport(null);
    };


    return (
        <>
            <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
                <h2 className="text-xl font-bold text-slate-100 mb-4">إعدادات النظام</h2>
                <div className="space-y-6">

                    {/* Backup and Restore Section */}
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                        <h3 className="text-lg font-semibold text-cyan-400 flex items-center gap-2">
                            النسخ الاحتياطي والاستعادة
                        </h3>
                        <p className="text-slate-400 mt-2 mb-4 text-sm">
                            تصدير جميع بيانات التطبيق الحالية إلى ملف لحفظها احتياطيًا. يمكنك استعادة البيانات من هذا الملف لاحقًا، ولكن كن حذرًا، فالاستيراد سيحذف جميع البيانات الحالية.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={handleExport}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-500"
                            >
                                <ArrowDownTrayIcon className="h-5 w-5"/>
                                تصدير البيانات
                            </button>
                            
                             <label
                                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white font-semibold rounded-lg shadow-md hover:bg-cyan-600 cursor-pointer"
                            >
                                <ArrowUpTrayIcon className="h-5 w-5"/>
                                <span>استيراد البيانات</span>
                                <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
                            </label>
                        </div>
                    </div>
                    
                    {/* Reset Data Section */}
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-red-500/30">
                        <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-5 w-5"/>
                            منطقة الخطر
                        </h3>
                        <p className="text-slate-400 mt-2 mb-4 text-sm">
                            الإجراء التالي سيؤدي إلى حذف جميع البيانات المحفوظة (المدراء المضافون، خطط العمل، سجلات المخاطر) وإعادة تعيين جميع مؤشرات الأداء إلى قيمها الافتراضية. هذا الإجراء نهائي ولا يمكن التراجع عنه.
                        </p>
                        <button
                            onClick={() => setIsResetConfirmOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
                        >
                            <ArrowPathIcon className="h-5 w-5"/>
                            إعادة تعيين بيانات التطبيق بالكامل
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmDeleteModal
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={handleResetConfirm}
                title="تأكيد إعادة تعيين التطبيق"
                message="هل أنت متأكد من رغبتك في إعادة تعيين التطبيق بالكامل؟ سيتم حذف جميع البيانات المخصصة والعودة إلى الحالة الافتراضية. لا يمكن التراجع عن هذا الإجراء."
            />
            
             <ConfirmDeleteModal
                isOpen={isImportConfirmOpen}
                onClose={() => setIsImportConfirmOpen(false)}
                onConfirm={handleImportConfirm}
                title="تأكيد استيراد البيانات"
                message="سيؤدي هذا الإجراء إلى الكتابة فوق جميع بيانات التطبيق الحالية بالبيانات الموجودة في الملف الذي حددته. هل أنت متأكد من أنك تريد المتابعة؟"
                icon={<InformationCircleIcon className="h-6 w-6 text-cyan-400" />}
                confirmButtonText="نعم، قم بالاستيراد"
                confirmButtonClass="bg-cyan-500 hover:bg-cyan-600"
            />
        </>
    );
};

export default SettingsTab;