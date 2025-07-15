
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { BeakerIcon, ArrowUpOnSquareIcon, DocumentTextIcon, XCircleIcon, SparklesIcon, ArrowPathIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { Spinner } from './Spinner.tsx';
import { generateProcedureRiskAssessment } from '../services/geminiService.tsx';
import type { ProcedureRiskAssessment } from '../data.tsx';
import { ROLES } from '../data.tsx';

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
  {
    id: 'pushback',
    name: 'توجيه ودفع الطائرات (Pushback & Marshalling)',
    description: 'يتم استقبال الطائرة بواسطة المارشال وتوجيهها إلى الموقف المحدد. بعد اكتمال الخدمة، يتم استخدام مركبة الدفع (Pushback) لدفع الطائرة للخلف وتوجيهها إلى ممر التحرك استعدادًا للإقلاع. يتم التواصل المستمر بين قائد المركبة وطاقم الطائرة.'
  },
  {
    id: 'baggage',
    name: 'مناولة أمتعة الركاب (تحميل وتفريغ)',
    description: 'يتم تفريغ الأمتعة من الطائرات القادمة ونقلها إلى منطقة استلام الحقائب. بالنسبة للرحلات المغادرة، يتم تحميل الأمتعة من عربات النقل إلى مخزن الطائرة بناءً على خطة التحميل. يتم التعامل مع الأمتعة بعناية لتجنب التلف.'
  },
  {
    id: 'refueling',
    name: 'تزويد الطائرات بالوقود',
    description: 'تقوم مركبة التزويد بالوقود بالاقتراب من الطائرة وتوصيل خرطوم الوقود. يتم التأكد من إيقاف تشغيل المحركات وتأمين منطقة العمل. يتم ضخ الكمية المحددة من الوقود مع مراقبة مستمرة لأي تسريبات. يتم تسجيل كمية الوقود التي تم تزويدها.'
  },
  {
    id: 'fod',
    name: 'فحص الأجسام الغريبة (FOD Check)',
    description: 'قبل وصول الطائرة وبعد مغادرتها، يقوم فريق العمل بمسح بصري لموقف الطائرة والمناطق المحيطة به للبحث عن أي أجسام غريبة (مسامير، قطع معدنية، إلخ) قد تسبب ضررًا لمحركات الطائرة أو إطاراتها. يتم جمع أي أجسام يتم العثور عليها والتخلص منها بشكل آمن.'
  },
  {
    id: 'gse',
    name: 'تأمين وتشغيل المعدات الأرضية (GSE)',
    description: 'يتم فحص المعدات الأرضية (مثل سلالم الركاب، سيور الأمتعة، وحدات الطاقة) قبل كل استخدام. عند الاقتراب من الطائرة، يتم ذلك بسرعة منخفضة وحذر. بعد الاستخدام، يتم إيقاف المعدات في الأماكن المخصصة لها وتأمينها باستخدام مكابح الوقوف.'
  },
   {
    id: 'dangerous_goods',
    name: 'التعامل مع البضائع الخطرة',
    description: 'يتم استلام البضائع الخطرة وتخزينها في منطقة مخصصة. يتم فحص الملصقات والوثائق للتأكد من مطابقتها للوائح IATA. عند التحميل، يتم إبلاغ قائد الطائرة بنوع وموقع البضائع الخطرة (NOTOC). يتم استخدام معدات الوقاية الشخصية المناسبة أثناء المناولة.'
  },
  {
    id: 'audit_procedure',
    name: 'إجراء تدقيق السلامة والجودة (Audit Procedure)',
    description: 'يتم إجراء تدقيقات دورية ومفاجئة على العمليات في ساحة المطار ومناطق خدمات الركاب. يتم خلالها مقارنة الممارسات الفعلية مع الإجراءات المعتمدة في دليل الشركة (GOM) ومعايير ISAGO. يتم توثيق أي ملاحظات أو حالات عدم تطابق في تقرير رسمي.'
  },
  {
    id: 'corrective_action',
    name: 'متابعة وإغلاق الإجراءات التصحيحية (Corrective Action Follow-up)',
    description: 'بعد اكتشاف مخالفة أو حادث، يتم فتح إجراء تصحيحي. يتم تحديد السبب الجذري للمشكلة، ووضع خطة عمل تحتوي على مهام ومسؤوليات ومواعيد نهائية. يتم متابعة تنفيذ الخطة حتى يتم التحقق من إغلاق الإجراء بشكل فعال.'
  },
  {
    id: 'security_screening',
    name: 'تطبيق إجراءات الفحص الأمني (Security Procedures)',
    description: 'يتم فحص جميع الموظفين والمعدات قبل دخول المناطق المحظورة أمنياً. يتم التحقق من هويات وتصاريح الدخول. يتم تطبيق إجراءات أمن الطيران مثل فحص الأمتعة وتأمين الطائرات ضد الوصول غير المصرح به.'
  },
  {
    id: 'incident_investigation',
    name: 'الإبلاغ والتحقيق في الحوادث (Incident Reporting and Investigation)',
    description: 'عند وقوع أي حادث (حادث ضرر أرضي، إصابة، حادث وشيك)، يتم إبلاغ قسم السلامة فورًا. يتم تأمين الموقع وجمع الأدلة وإجراء مقابلات مع الشهود. يتم إعداد تقرير تحقيق يوضح تسلسل الأحداث والأسباب الجذرية والتوصيات لمنع التكرار.'
  },
];


const RiskAssessmentTab = () => {
    const [procedureText, setProcedureText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ProcedureRiskAssessment | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedProcedureId, setSelectedProcedureId] = useState('');

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
    
    const handleRemoveFile = () => {
        setFile(null);
    }

    const handleProcedureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedProcedureId(id);
        // Per user request, do not auto-fill the description.
        // Instead, clear the textarea to allow the user to enter a new description for the selected procedure.
        setProcedureText('');
    };
    
    const handleAnalyze = () => {
        if (!file || !procedureText.trim()) {
            toast.error("يرجى وصف الإجراء ورفع الدليل المرجعي أولاً.");
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

        readFileAsBase64(file)
            .then(base64Data => {
                return generateProcedureRiskAssessment(procedureText, base64Data, file.type);
            })
            .then(result => {
                setAnalysisResult(result);
                toast.success('اكتمل تحليل المخاطر بنجاح!', { id: toastId });
            })
            .catch(err => {
                console.error("Analysis failed:", err);
                const errorMessage = err.message.includes('quota') 
                    ? "تم تجاوز الحصة المتاحة. يرجى المحاولة مرة أخرى لاحقًا."
                    : "فشل في تحليل الملف. قد يكون نوع الملف غير مدعوم أو أن المحتوى غير واضح.";
                setError(errorMessage);
                toast.error(errorMessage, { id: toastId, duration: 5000 });
            })
            .finally(() => {
                setIsLoading(false);
            });
    }
    
    const handleReset = () => {
        setFile(null);
        setProcedureText('');
        setAnalysisResult(null);
        setError(null);
        setIsLoading(false);
        setSelectedProcedureId('');
    }
    
    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center gap-4 py-16">
                    <Spinner className="h-10 w-10" />
                    <p className="text-slate-300 text-lg">يقوم الذكاء الاصطناعي بمقارنة الإجراء مع الدليل...</p>
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
            )
        }
        
        if (analysisResult) {
            const complianceStyle = COMPLIANCE_COLOR[analysisResult.compliance_analysis.overall_compliance_level] || COMPLIANCE_COLOR['انحرافات كبيرة'];
            return (
                 <div className="space-y-6 animate-fade-in">
                    {/* Overall Assessment */}
                    <div className="p-4 bg-slate-900/50 rounded-lg border-l-4 border-cyan-500">
                        <h4 className="font-bold text-cyan-400 mb-2">التقييم العام</h4>
                        <p>{analysisResult.overall_assessment}</p>
                    </div>
                    
                    {/* Compliance Analysis */}
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

                    {/* Identified Risks */}
                    <div>
                        <h3 className="text-xl font-bold text-slate-100 mb-3">المخاطر المحددة ({analysisResult.identified_risks.length})</h3>
                        <div className="space-y-3">
                            {analysisResult.identified_risks.map((risk, index) => (
                                <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                    <h5 className="font-bold text-orange-400">{risk.risk_title}</h5>
                                    <p className="text-sm text-slate-300 mt-1 mb-3">{risk.risk_description}</p>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded-full">{risk.category}</span>
                                        <span className={`px-2 py-1 ${LIKELIHOOD_COLOR[risk.likelihood] || 'bg-slate-600'} text-white rounded-full`}>الاحتمالية: {risk.likelihood}</span>
                                        <span className={`px-2 py-1 ${IMPACT_COLOR[risk.impact] || 'bg-slate-600'} text-white rounded-full`}>التأثير: {risk.impact}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* Mitigation Steps */}
                     <div>
                        <h3 className="text-xl font-bold text-slate-100 mb-3">خطوات التخفيف المقترحة ({analysisResult.mitigation_steps.length})</h3>
                        <div className="space-y-3">
                             {analysisResult.mitigation_steps.map((step, index) => (
                                <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                    <h5 className="font-bold text-green-400">{step.step_title}</h5>
                                    <p className="text-sm text-slate-300 mt-1 mb-3">{step.step_description}</p>
                                    <div className="text-xs">
                                        <span className="px-2 py-1 bg-cyan-900 text-cyan-300 rounded-full">القسم المسؤول: {ROLES[step.responsible_department]}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                     <button
                        onClick={handleReset}
                        className="w-full mt-6 inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-500"
                    >
                        <ArrowPathIcon className="h-5 w-5" />
                        إجراء تقييم جديد
                    </button>
                 </div>
            );
        }

        // Initial View
        return (
             <div className="space-y-6">
                <div>
                    <label htmlFor="procedure-select" className="block text-lg font-semibold text-slate-300 mb-2">1. اختر تقييمًا أو صف الإجراء</label>
                    <p className="text-slate-400 mb-4 text-sm">اختر أحد الإجراءات الشائعة عالية المخاطر من القائمة أدناه، ثم صف الإجراء بالتفصيل. أو يمكنك كتابة وصف لإجراء آخر مباشرة.</p>
                     <select 
                        id="procedure-select"
                        value={selectedProcedureId}
                        onChange={handleProcedureChange}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-4"
                    >
                        <option value="">-- اختر إجراءً شائعًا (اختياري) --</option>
                        {PREDEFINED_PROCEDURES.map(proc => (
                            <option key={proc.id} value={proc.id}>{proc.name}</option>
                        ))}
                    </select>

                    <label htmlFor="procedure-text" className="block text-sm font-medium text-slate-400 mb-2">وصف الإجراء الحالي</label>
                    <textarea 
                        id="procedure-text"
                        value={procedureText}
                        onChange={(e) => {
                            setProcedureText(e.target.value);
                            if (selectedProcedureId) {
                                setSelectedProcedureId('');
                            }
                        }}
                        rows={6}
                        placeholder="اكتب هنا وصفًا تفصيليًا لكيفية تنفيذ الإجراء حاليًا على أرض الواقع..."
                        className="w-full bg-slate-900 border border-slate-600 text-white rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                    />
                </div>

                <div>
                    <label className="block text-lg font-semibold text-slate-300 mb-2">2. رفع الدليل الرسمي للمقارنة</label>
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
                    disabled={!file || !procedureText.trim() || isLoading}
                    className="w-full max-w-sm mx-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed"
                >
                    <SparklesIcon className="h-6 w-6" />
                    تحليل الامتثال والمخاطر
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
                صف الإجراء الحالي، ارفع الدليل الرسمي، ودع الذكاء الاصطناعي يحلل فجوات الامتثال والمخاطر المترتبة عليها.
            </p>
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
