import React, { useState, useContext } from 'react';
import { AppDispatchContext } from '../context/AppContext.tsx';
import { toast } from 'react-hot-toast';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { ConfirmDeleteModal } from './ConfirmDeleteModal.tsx';

const SettingsTab = () => {
    const dispatch = useContext(AppDispatchContext);
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

    const handleResetConfirm = () => {
        dispatch({ type: 'RESET_ALL_HISTORY' });
        toast.success('تمت إعادة تعيين بيانات التطبيق إلى الحالة الافتراضية.');
        setIsResetConfirmOpen(false);
    };

    return (
        <>
            <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
                <h2 className="text-xl font-bold text-slate-100 mb-4">إعدادات النظام</h2>
                <div className="space-y-6">
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
        </>
    );
};

export default SettingsTab;