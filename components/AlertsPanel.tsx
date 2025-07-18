import React, { useContext } from 'react';
import type { Alert } from '../data.tsx';
import { AppDispatchContext } from '../context/AppContext.tsx';
import { BellAlertIcon } from '@heroicons/react/24/solid';

type AlertsPanelProps = {
    alerts: Alert[];
    onClose: () => void;
};

// Function to calculate "time ago"
const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return "الآن";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.round(hours / 24);
    return `منذ ${days} يوم`;
};


export const AlertsPanel = ({ alerts, onClose }: AlertsPanelProps) => {
    const dispatch = useContext(AppDispatchContext);

    const handleAlertClick = (alert: Alert) => {
        dispatch({ type: 'SET_SELECTED_MANAGER', payload: alert.managerId });
        dispatch({ type: 'SET_VIEW', payload: 'manager'});
        dispatch({ type: 'MARK_ALERT_READ', payload: { alertId: alert.id }});
        onClose();
    };
    
    const handleMarkAllRead = () => {
        dispatch({ type: 'MARK_ALERT_READ', payload: { all: true } });
    }

    const unreadAlerts = alerts.filter(a => !a.isRead);

    return (
        <div 
            className="absolute top-full mt-2 end-0 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 animate-fade-in-down"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-center p-3 border-b border-slate-700">
                <h3 className="font-bold text-white">التنبيهات</h3>
                {unreadAlerts.length > 0 && (
                     <button onClick={handleMarkAllRead} className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold">
                        تحديد الكل كمقروء
                    </button>
                )}
            </div>
            <div className="max-h-96 overflow-y-auto">
                {alerts.length > 0 ? (
                    <ul>
                        {alerts.map(alert => (
                            <li 
                                key={alert.id} 
                                onClick={() => handleAlertClick(alert)}
                                className={`p-3 border-b border-slate-700/50 hover:bg-slate-700/50 cursor-pointer ${!alert.isRead ? 'bg-cyan-900/20' : ''}`}
                            >
                                <div className="flex justify-between items-center text-xs text-slate-400 mb-1">
                                    <span>{alert.managerName}</span>
                                    <span>{timeAgo(alert.timestamp)}</span>
                                </div>
                                <p className="text-sm text-slate-200">
                                    انخفاض أداء <span className="font-bold text-yellow-400">{alert.kpiName}</span> إلى <span className="font-bold">{alert.kpiScore}%</span>.
                                </p>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="p-8 text-center text-slate-500">
                         <BellAlertIcon className="h-10 w-10 mx-auto mb-2"/>
                        <p>لا توجد تنبيهات حالياً.</p>
                        <p className="text-xs">كل شيء على ما يرام!</p>
                    </div>
                )}
            </div>
        </div>
    );
};