import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import { isAiAvailable } from '../services/geminiService.tsx';

export const ApiBanner = () => {
    if (isAiAvailable) {
        return null;
    }

    return (
        <div className="bg-yellow-500/10 border-t border-b border-yellow-500/20 px-4 py-3 text-yellow-300 no-print">
            <div className="container mx-auto">
                <div className="flex items-center">
                    <ExclamationTriangleIcon className="h-6 w-6 me-3 text-yellow-400" />
                    <div className="text-sm font-semibold">
                        <span className="font-bold">تنبيه:</span> ميزات الذكاء الاصطناعي معطلة. لم يتم تكوين مفتاح الواجهة البرمجية (API_KEY) في بيئة النشر.
                    </div>
                </div>
            </div>
        </div>
    );
};
