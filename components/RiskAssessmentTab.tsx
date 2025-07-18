import React, { useState, useContext } from 'react';
import { toast } from 'react-hot-toast';
import { BeakerIcon, ArrowUpOnSquareIcon, DocumentTextIcon, XCircleIcon, SparklesIcon, ArrowPathIcon, ScaleIcon, CheckBadgeIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { Spinner } from './Spinner.tsx';
import { generateDiscrepancyAnalysis, assessProcedureFromManual, API_KEY_ERROR_MESSAGE, isAiAvailable } from '../services/geminiService.tsx';
import type { ProcedureRiskAssessment, StandardProcedureAssessment, IdentifiedRisk } from '../data.tsx';
import { ROLES } from '../data.tsx';
import { AppDispatchContext } from '../context/AppContext.tsx';

// A map to translate risk levels to colors for UI
const LIKELIHOOD_COLOR: Record<string, string> = { 'نادر': 'bg-sky-500', 'غير محتمل': 'bg-green-500', 'محتمل': 'bg-yellow-500', 'مرجح': 'bg-orange-500', 'شبه مؤكد': 'bg-red-500' };
const IMPACT_COLOR: Record<string, string> = { 'ضئيل': 'bg-sky-500', 'طفيف': 'bg-green-500', 'متوسط': 'bg-yellow-500', 'كبير': 'bg-orange-500', 'كارثي': 'bg-red-500' };
const COMPLIANCE_COLOR: Record<string, { bg: string; text: string; border: string; }> = {
    'متوافق': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
    'انحرافات طفيفة': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    'انحرافات كبيرة': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    'غير متوافق': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
};

const PREDEFINED_PROCEDURES = [
  { id: 'turnaround_coordination', name: 'تنسيق ومراقبة خدمة الطائرة (Turnaround Coordination)' },
  { id: 'marshalling_chocking', name: 'توجيه وإيقاف وتأمين الطائرة (Marshalling & Chocking)' },
  { id: 'pushback_towing', name: 'دفع وسحب الطائرة (Pushback & Towing)' },
  { id: 'baggage_handling', name: 'مناولة أمتعة الركاب (تحميل وتفريغ)' },
  { id: 'cargo_handling', name: 'مناولة البضائع والبريد (Cargo & Mail Handling)' },
  { id: 'dangerous_goods', name: 'مناولة المواد الخطرة (Dangerous Goods Handling)' },
  { id: 'gse_operation', name: 'تشغيل المعدات الأرضية (GSE Operation)' },
  { id: 'pbb_operation', name: 'تشغيل جسر الركاب (Passenger Boarding Bridge Operation)' },
  { id: 'fuelling_operations', name: 'عمليات تزويد الطائرات بالوقود (Aircraft Fuelling Operations)' },
  { id: 'water_lavatory_service', name: 'خدمات المياه والمرافق للطائرة (Water & Lavatory Services)' },
  { id: 'deicing_anti_icing', name: 'إزالة الجليد ومقاومة التجمد (De-icing / Anti-icing)' },
  { id: 'fod_prevention', name: 'برنامج منع الأجسام الغريبة (FOD Prevention)' },
  { id: 'incident_emergency_response', name: 'إدارة الحوادث والاستجابة للطوارئ (Incident & Emergency Response)' },
  { id: 'sqms_audit', name: 'تدقيق نظام إدارة السلامة والجودة (SQMS Audit)' },
  { id: 'load_control', name: 'مراقبة الحمولة والتوازن (Load Control & Weight and Balance)' },
];


const RiskAssessmentTab = () => {
    const dispatch = useContext(AppDispatchContext);
    const [analysisMode, setAnalysisMode] = useState<'custom' | 'standard'>('custom');
    const [procedureText, setProcedureText] = useState('');
    const [selectedProcedureId, setSelectedProcedureId] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ProcedureRiskAssessment | StandardProcedureAssessment | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const uploadedFile = e.target.files[0];
            if (uploadedFile.size > 20 * 1024 * 1024) { // 20MB limit
                toast.error("حجم الملف كبير جدًا. الرجاء اختيار ملف أصغر من 20 ميجابايت.");
                return;
            }
            setFile(uploadedFile);
        }
    };
    
    const handleRemoveFile = () => setFile(null);
    
    const handleModeChange = (mode: 'custom' | 'standard') => {
        if (analysisMode !== mode) {
            // Reset state related to the previous mode, but preserve the file
            setProcedureText('');
            setSelectedProcedureId('');
            setAnalysisResult(null);
            setError(null);
            setIsLoading(false);
            setAnalysisMode(mode);
        }
    };

    const handleAnalyze = async () => {
        if (!file) {
            toast.error("يرجى رفع الدليل المرجعي أولاً.");
            return;
        }

        if (analysisMode === 'custom' && !procedureText.trim()) {
            toast.error("يرجى وصف الإجراء الحالي للمقارنة.");
            return;
        }

        if (analysisMode === 'standard' && !selectedProcedureId) {
            toast.error("يرجى اختيار إجراء شائع من القائمة للتقييم.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        const toastId = toast.loading('جارٍ قراءة الإدخالات وتحليلها بواسطة الذكاء الاصطناعي...');
        
        const readFileAsBase64 = (fileToRead: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(fileToRead);
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = error => reject(error);
            });
        };

        try {
            const base64Data = await readFileAsBase64(file);
            const procedureName = PREDEFINED_PROCEDURES.find(p => p.id === selectedProcedureId)?.name || '';

            const result = analysisMode === 'custom'
                ? await generateDiscrepancyAnalysis(procedureText, base64Data, file.type)
                : await assessProcedureFromManual(procedureName, base64Data, file.type);
            
            setAnalysisResult(result);
            toast.success('اكتمل التحليل بنجاح!', { id: toastId });
        } catch (err: any) {
            console.error("Analysis failed:", err);
            let errorMessage;
            if (err.message === API_KEY_ERROR_MESSAGE) {
                errorMessage = API_KEY_ERROR_MESSAGE;
            } else if (err.message.includes('quota')) {
                errorMessage = "تم تجاوز الحصة المتاحة. يرجى المحاولة مرة أخرى لاحقًا.";
            } else {
                errorMessage = "فشل في تحليل الملف. قد يكون نوع الملف غير مدعوم أو أن المحتوى غير واضح.";
            }
            setError(errorMessage);
            toast.error(errorMessage, { id: toastId, duration: 5000 });
        } finally {
            setIsLoading(false);
        }
    }
    
    const handleReset = () => {
        setFile(null);
        setProcedureText('');
        setSelectedProcedureId('');
        setAnalysisResult(null);
        setError(null);
        setIsLoading(false);
    }
    
    const handleAddToRegister = (risk: IdentifiedRisk) => {
        const sourceName = analysisMode === 'custom' 
            ? `تحليل مخصص: ${procedureText.substring(0, 30)}...`
            : `تقييم إجراء: ${PREDEFINED_PROCEDURES.find(p => p.id === selectedProcedureId)?.name || 'غير معروف'}`;

        dispatch({ type: 'ADD_TO_RISK_REGISTER', payload: { risk, source: sourceName } });
        toast.success(`تمت إضافة "${risk.risk_title}" إلى سجل المخاطر.`);
    };
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center gap-4 py-16">
                    <Spinner className="h-10 w-10" />
                    <p className="text-slate-300 text-lg">يقوم الذكاء الاصطناعي بالتحليل...</p>
                    <p className="text-slate-500">قد تستغرق هذه العملية دقيقة أو أكثر.</p>
                </div>
            );
        }
        
        if (error) {
            return (
                <div className="text-center text-red-400 bg-red-900/50 p-6 rounded-lg">
                    <h3 className="font-bold mb-2">حدث خطأ</h3>
                    <p>{error}</p>
                    <button onClick={handleReset} className="mt-4 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg">
                        المحاولة مرة أخرى
                    </button>
                </div>
            );
        }
        
        if (analysisResult) {
            // Render discrepancy analysis view
            if ('compliance_analysis' in analysisResult) {
                const complianceStyle = COMPLIANCE_COLOR[analysisResult.compliance_analysis.overall_compliance_level] || COMPLIANCE_COLOR['انحرافات كبيرة'];
                return (
                     <div className="space-y-6 animate-fade-in">
                        <div className="p-4 bg-slate-900/50 rounded-lg border-l-4 border-cyan-500">
                            <h4 className="font-bold text-cyan-400 mb-2">التقييم العام</h4>
                            <p>{analysisResult.overall_assessment}</p>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-100 mb-3 flex items-center gap-2"><ScaleIcon className="h-6 w-6"/>تحليل الامتثال</h3>
                             <div className={`p-4 rounded-lg border ${complianceStyle.border} ${complianceStyle.bg} mb-4`}>
                                <h5 className={`font-bold ${complianceStyle.text} mb-1`}>مستوى الامتثال العام: {analysisResult.compliance_analysis.overall_compliance_level}</h5>
                                <p className="text-sm text-slate-300">{analysisResult.compliance_analysis.summary}</p>
                            </div>
                            {analysisResult.compliance_analysis.discrepancies.length > 0 && (
                                <div className="space-y-4">
                                    <h4 className="font-semibold text-yellow-400">الانحرافات المكتشفة:</h4>
                                    {analysisResult.compliance_analysis.discrepancies.map((d, i) => (
                                    <div key={i} className="bg-slate-900/50 p-4 rounded-lg border border-yellow-500/30">
                                        <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <h5 className="font-semibold text-slate-300 mb-2">الممارسة الموصوفة (كما هي مطبقة)</h5>
                                            <p className="text-sm bg-slate-800 p-2 rounded-md border border-slate-700 h-full">{d.described_practice}</p>
                                        </div>
                                        <div>
                                            <h5 className="font-semibold text-slate-300 mb-2">إرشادات الدليل الرسمي</h5>
                                            <p className="text-sm bg-slate-800 p-2 rounded-md border border-slate-700 h-full">{d.manual_guideline}</p>
                                        </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-700">
                                        <h5 className="font-semibold text-yellow-400 mb-1">الأثر على المخاطر:</h5>
                                        <p className="text-sm">{d.risk_implication}</p>
                                        </div>
                                    </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div>
                            <h3 className="text-xl font-bold text-slate-100 mb-3">المخاطر المحددة ({analysisResult.identified_risks.length})</h3>
                            <div className="space-y-3">
                                {analysisResult.identified_risks.map((risk, index) => (
                                    <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex-grow">
                                                <h5 className="font-bold text-orange-400">{risk.risk_title}</h5>
                                                <p className="text-sm text-slate-300 mt-1 mb-3">{risk.risk_description}</p>
                                            </div>
                                            <button onClick={() => handleAddToRegister(risk)} className="flex-shrink-0 inline-flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 font-semibold">
                                                <PlusCircleIcon className="h-5 w-5"/>
                                                <span>إضافة للسجل</span>
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-xs mt-2">
                                            <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded-full">{risk.category}</span>
                                            <span className={`px-2 py-1 ${LIKELIHOOD_COLOR[risk.likelihood]} text-white rounded-full`}>الاحتمالية: {risk.likelihood}</span>
                                            <span className={`px-2 py-1 ${IMPACT_COLOR[risk.impact]} text-white rounded-full`}>التأثير: {risk.impact}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                         <button onClick={handleReset} className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-500">
                            <ArrowPathIcon className="h-5 w-5" />
                            إجراء تقييم جديد
                        </button>
                     </div>
                );
            }

            // Render standard procedure assessment view
            if ('inherent_risks' in analysisResult) {
                return (
                     <div className="space-y-6 animate-fade-in">
                        <div className="p-4 bg-slate-900/50 rounded-lg border-l-4 border-cyan-500">
                            <h4 className="font-bold text-cyan-400 mb-2">التقييم العام للإجراء الرسمي</h4>
                            <p>{analysisResult.overall_assessment}</p>
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                            <h4 className="font-bold text-cyan-400 mb-2">ملخص الإجراء من الدليل</h4>
                            <p>{analysisResult.procedure_summary}</p>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-100 mb-3">المخاطر الكامنة في الإجراء ({analysisResult.inherent_risks.length})</h3>
                            <div className="space-y-3">
                                {analysisResult.inherent_risks.map((risk, index) => (
                                    <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                        <h5 className="font-bold text-orange-400">{risk.risk_title}</h5>
                                        <p className="text-sm text-slate-300 mt-1 mb-3">{risk.risk_description}</p>
                                        <div className="text-xs">
                                            <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded-full">{risk.category}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                         <div>
                            <h3 className="text-xl font-bold text-slate-100 mb-3">استراتيجيات التخفيف المقترحة ({analysisResult.mitigation_strategies.length})</h3>
                            <div className="space-y-3">
                                 {analysisResult.mitigation_strategies.map((step, index) => (
                                    <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                        <h5 className="font-bold text-green-400">{step.strategy_title}</h5>
                                        <p className="text-sm text-slate-300 mt-1 mb-3">{step.strategy_description}</p>
                                        <div className="text-xs">
                                            <span className="px-2 py-1 bg-cyan-900 text-cyan-300 rounded-full">القسم المسؤول: {ROLES[step.responsible_department]}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                         <button onClick={handleReset} className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-500">
                            <ArrowPathIcon className="h-5 w-5" />
                            إجراء تقييم جديد
                        </button>
                     </div>
                );
            }
        }

        // Initial View
        return (
             <div className="space-y-6">
                {/* Inputs based on mode */}
                 <div>
                    <label className="block text-lg font-semibold text-slate-300 mb-2">1. حدد الإجراء</label>
                    {analysisMode === 'custom' ? (
                        <textarea 
                            id="procedure-text"
                            value={procedureText}
                            onChange={(e) => setProcedureText(e.target.value)}
                            rows={6}
                            placeholder="اكتب هنا وصفًا تفصيليًا لكيفية تنفيذ الإجراء حاليًا على أرض الواقع للمقارنة مع الدليل..."
                            className="w-full bg-slate-900 border border-slate-600 text-white rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                        />
                    ) : (
                         <select 
                            id="procedure-select"
                            value={selectedProcedureId}
                            onChange={e => setSelectedProcedureId(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="">-- اختر إجراءً شائعًا لتقييم مخاطره من الدليل --</option>
                            {PREDEFINED_PROCEDURES.map(proc => (
                                <option key={proc.id} value={proc.id}>{proc.name}</option>
                            ))}
                        </select>
                    )}
                 </div>

                <div>
                    <label className="block text-lg font-semibold text-slate-300 mb-2">2. ارفع الدليل الرسمي</label>
                    <div className="relative border-2 border-dashed border-slate-600 rounded-lg p-6 hover:border-cyan-500 bg-slate-800/50 transition-colors text-center">
                        <ArrowUpOnSquareIcon className="mx-auto h-10 w-10 text-slate-500" />
                        <p className="mt-1 text-sm text-slate-400">اسحب وأفلت الملف هنا، أو انقر للتصفح.</p>
                        <p className="mt-1 text-xs text-slate-500">(يدعم: PDF, DOCX, TXT - بحد أقصى 20MB)</p>
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                            accept=".pdf,.doc,.docx,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        />
                    </div>
                    {file && (
                        <div className="mt-4 p-3 bg-slate-700/50 rounded-lg inline-flex items-center gap-3 animate-fade-in">
                            <DocumentTextIcon className="h-6 w-6 text-cyan-400"/>
                            <span className="text-slate-200">{file.name}</span>
                            <button onClick={handleRemoveFile} className="text-slate-500 hover:text-red-400"><XCircleIcon className="h-5 w-5"/></button>
                        </div>
                    )}
                </div>

                 <button
                    onClick={handleAnalyze}
                    disabled={!file || isLoading || (analysisMode === 'custom' && !procedureText.trim()) || (analysisMode === 'standard' && !selectedProcedureId) || !isAiAvailable}
                    title={!isAiAvailable ? API_KEY_ERROR_MESSAGE : undefined}
                    className="w-full max-w-sm mx-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    <SparklesIcon className="h-6 w-6" />
                    تحليل
                </button>
            </div>
        );
    }
    
    return (
        <div className="bg-slate-800 rounded-lg shadow-lg p-5 border border-slate-700">
            <h2 className="text-xl font-bold text-slate-100 mb-1 flex items-center gap-2">
                <BeakerIcon className="h-6 w-6 text-cyan-400"/>
                تقييم المخاطر الإجرائي
            </h2>
            <p className="text-sm text-slate-400 mb-6">
                استخدم الذكاء الاصطناعي لتحليل إجراءات العمل، ومقارنتها بالدليل الرسمي، وتقييم المخاطر الكامنة بشكل استباقي.
            </p>
            
            {/* Mode Selector */}
            <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-700 mb-6">
                <button
                    onClick={() => handleModeChange('custom')}
                    className={`flex-1 py-2 px-4 text-sm font-semibold rounded-md transition-colors ${analysisMode === 'custom' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:bg-slate-700/50'}`}
                >
                    تحليل إجراء مخصص حالي
                </button>
                <button
                    onClick={() => handleModeChange('standard')}
                    className={`flex-1 py-2 px-4 text-sm font-semibold rounded-md transition-colors ${analysisMode === 'standard' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:bg-slate-700/50'}`}
                >
                    تقييم مخاطر إجراء شائع
                </button>
            </div>

            {renderContent()}
             <style>{`
                 @keyframes fade-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
            `}</style>
        </div>
    )
};

export default RiskAssessmentTab;