import React, { useState, useContext, useMemo } from 'react';
import { AppStateContext, AppDispatchContext } from '../context/AppContext.tsx';
import type { RegisteredRisk, RiskStatus } from '../data.tsx';
import { ShieldExclamationIcon, FunnelIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';


const STATUS_OPTIONS: RiskStatus[] = ['مفتوح', 'قيد المراجعة', 'تم التخفيف', 'مغلق'];
const STATUS_STYLES: Record<RiskStatus, string> = {
    'مفتوح': 'bg-red-500/20 text-red-400 border-red-500/30',
    'قيد المراجعة': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'تم التخفيف': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'مغلق': 'bg-green-500/20 text-green-400 border-green-500/30',
};

const LIKELIHOOD_COLOR: Record<string, string> = { 'نادر': 'bg-sky-500', 'غير محتمل': 'bg-green-500', 'محتمل': 'bg-yellow-500', 'مرجح': 'bg-orange-500', 'شبه مؤكد': 'bg-red-500' };
const IMPACT_COLOR: Record<string, string> = { 'ضئيل': 'bg-sky-500', 'طفيف': 'bg-green-500', 'متوسط': 'bg-yellow-500', 'كبير': 'bg-orange-500', 'كارثي': 'bg-red-500' };


const RiskRegisterTab = () => {
    const { riskRegister } = useContext(AppStateContext);
    const dispatch = useContext(AppDispatchContext);
    const [statusFilter, setStatusFilter] = useState<RiskStatus | 'all'>('all');
    
    const sortedRisks = useMemo(() => {
        return [...riskRegister].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [riskRegister]);

    const filteredRisks = useMemo(() => {
        if (statusFilter === 'all') return sortedRisks;
        return sortedRisks.filter(risk => risk.status === statusFilter);
    }, [sortedRisks, statusFilter]);

    const handleStatusChange = (riskId: string, newStatus: RiskStatus) => {
        dispatch({ type: 'UPDATE_RISK_STATUS', payload: { riskId, newStatus } });
        toast.success('تم تحديث حالة المخاطرة.');
    };

    return (
        <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <ShieldExclamationIcon className="h-6 w-6 text-cyan-400" />
                    سجل المخاطر المتكامل
                </h2>
                <div className="flex items-center gap-2 text-sm">
                    <FunnelIcon className="h-5 w-5 text-slate-400" />
                    <span className="text-slate-300">تصفية حسب الحالة:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-slate-700 border border-slate-600 text-white rounded-md py-1 px-2 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    >
                        <option value="all">الكل</option>
                        {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
            </div>

            {filteredRisks.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-700/50">
                            <tr>
                                <th scope="col" className="px-6 py-3">المخاطرة</th>
                                <th scope="col" className="px-6 py-3">التصنيف</th>
                                <th scope="col" className="px-6 py-3">الاحتمالية/التأثير</th>
                                <th scope="col" className="px-6 py-3">تاريخ الإضافة</th>
                                <th scope="col" className="px-6 py-3">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRisks.map(risk => (
                                <tr key={risk.id} className="border-b border-slate-700 hover:bg-slate-800/50">
                                    <th scope="row" className="px-6 py-4 font-medium text-slate-200 whitespace-nowrap">
                                        <p className="font-bold">{risk.risk_title}</p>
                                        <p className="text-xs text-slate-400 mt-1 max-w-sm truncate" title={risk.risk_description}>{risk.risk_description}</p>
                                    </th>
                                    <td className="px-6 py-4">{risk.category}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-xs text-white rounded-full ${LIKELIHOOD_COLOR[risk.likelihood]}`}>{risk.likelihood}</span>
                                            <span className={`px-2 py-0.5 text-xs text-white rounded-full ${IMPACT_COLOR[risk.impact]}`}>{risk.impact}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{new Date(risk.createdAt).toLocaleDateString('ar-EG')}</td>
                                    <td className="px-6 py-4">
                                        <select
                                            value={risk.status}
                                            onChange={(e) => handleStatusChange(risk.id, e.target.value as RiskStatus)}
                                            className={`w-full text-xs font-semibold p-1.5 rounded-md border-2 bg-transparent focus:outline-none focus:ring-1 focus:ring-offset-0 focus:ring-offset-slate-800 focus:ring-white ${STATUS_STYLES[risk.status]}`}
                                        >
                                            {STATUS_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-slate-800 text-white font-bold">{opt}</option>)}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-16 px-6 bg-slate-800/50 rounded-lg border border-dashed border-slate-700">
                    <ShieldExclamationIcon className="mx-auto h-12 w-12 text-slate-600" />
                    <h3 className="mt-2 text-xl font-semibold text-white">سجل المخاطر فارغ</h3>
                    <p className="mt-1 text-sm text-slate-400">
                        لم يتم العثور على مخاطر تطابق هذه التصفية. قم بإضافة مخاطر من تبويب "تحليل المخاطر الإجرائي".
                    </p>
                </div>
            )}
        </div>
    );
};

export default RiskRegisterTab;
