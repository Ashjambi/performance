
import React, { useState, useContext, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { AppStateContext } from '../context/AppContext.tsx';
import { askConversational } from '../services/geminiService.tsx';
import { Spinner } from './Spinner.tsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
    role: 'user' | 'model';
    content: string;
};

type AskGeminiProps = {
    isOpen: boolean;
    onClose: () => void;
};

export const AskGemini = ({ isOpen, onClose }: AskGeminiProps) => {
    const appState = useContext(AppStateContext);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const responseText = await askConversational(input, appState);
            const modelMessage: Message = { role: 'model', content: responseText };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Error asking Gemini:", error);
            const errorMessage: Message = { role: 'model', content: 'عذراً، حدث خطأ أثناء التواصل مع المساعد. يرجى المحاولة مرة أخرى.' };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };
    
    // Reset state when modal is closed
    useEffect(() => {
        if (!isOpen) {
            setMessages([]);
            setInput('');
            setIsLoading(false);
        } else {
             setMessages([{
                role: 'model',
                content: 'أهلاً بك! أنا مساعدك الذكي Gemini. كيف يمكنني مساعدتك في تحليل بيانات الأداء اليوم؟'
            }]);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:justify-end p-0 sm:p-4" onClick={onClose}>
            <div
                className="bg-slate-800 border border-slate-700 w-full h-full sm:w-[400px] sm:h-[600px] sm:max-h-[90vh] rounded-none sm:rounded-xl shadow-2xl flex flex-col transition-transform duration-300 scale-95 animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <SparklesIcon className="h-6 w-6 text-cyan-400" />
                        اسأل Gemini
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </header>

                {/* Messages */}
                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && <SparklesIcon className="h-6 w-6 text-cyan-400 flex-shrink-0 mt-1" />}
                            <div className={`max-w-[85%] rounded-2xl p-3 ${msg.role === 'user' ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                                <div className="prose prose-sm prose-invert prose-p:my-0 prose-ul:my-2 prose-ol:my-2 prose-headings:my-2 text-white">
                                     <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex items-start gap-3">
                            <SparklesIcon className="h-6 w-6 text-cyan-400 flex-shrink-0 mt-1" />
                            <div className="bg-slate-700 text-slate-200 rounded-2xl p-3 rounded-bl-none">
                                <Spinner className="h-5 w-5"/>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="اطرح سؤالاً عن الأداء..."
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            disabled={isLoading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="p-3 bg-cyan-500 text-white rounded-full hover:bg-cyan-600 disabled:bg-slate-600 disabled:cursor-not-allowed"
                        >
                            <PaperAirplaneIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
                 <style>{`
                    @keyframes scale-in {
                        from { transform: scale(0.95) translateY(20px); opacity: 0; }
                        to { transform: scale(1) translateY(0); opacity: 1; }
                    }
                    .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
                    .prose-invert {
                        --tw-prose-body: #d1d5db;
                        --tw-prose-headings: #ffffff;
                        --tw-prose-lead: #e5e7eb;
                        --tw-prose-links: #38bdf8;
                        --tw-prose-bold: #ffffff;
                        --tw-prose-counters: #9ca3af;
                        --tw-prose-bullets: #6b7280;
                        --tw-prose-hr: #4b5563;
                        --tw-prose-quotes: #f9fafb;
                        --tw-prose-quote-borders: #4b5563;
                        --tw-prose-captions: #9ca3af;
                        --tw-prose-code: #ffffff;
                        --tw-prose-pre-code: #d1d5db;
                        --tw-prose-pre-bg: #1f2937;
                        --tw-prose-th-borders: #4b5563;
                        --tw-prose-td-borders: #374151;
                    }
                `}</style>
            </div>
        </div>
    );
};
