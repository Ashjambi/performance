


import React, { useState, useContext, useRef, useEffect } from 'react';
import { PaperAirplaneIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { AppStateContext } from '../context/AppContext.js';
import { askConversational } from '../services/geminiService.js';
import { Spinner } from './Spinner.js';
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
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    
    useEffect(() => {
        if(isOpen) {
            setMessages([
                { role: 'model', content: 'أهلاً بك! أنا مساعدك الذكي. كيف يمكنني مساعدتك في تحليل بيانات الأداء اليوم؟' }
            ]);
        } else {
            setMessages([]);
            setInput('');
        }
    }, [isOpen]);

    const handleSend = async () => {
        if (input.trim() === '' || isLoading) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await askConversational(input, appState);
            const modelMessage: Message = { role: 'model', content: response };
            setMessages(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error(error);
            const errorMessage: Message = { role: 'model', content: 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.' };
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


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 z-50 no-print" onClick={onClose}>
            <div 
                className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-lg h-[70vh] flex flex-col transition-transform duration-300 scale-95 animate-scale-in"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <SparklesIcon className="h-6 w-6 text-cyan-400" />
                        اسأل Gemini
                    </h2>
                    <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-700" aria-label="إغلاق"><XMarkIcon className="h-6 w-6" /></button>
                </header>

                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && <div className="p-2 bg-cyan-500/20 rounded-full flex-shrink-0"><SparklesIcon className="h-5 w-5 text-cyan-400" /></div>}
                            <div className={`max-w-md p-3 rounded-lg ${msg.role === 'user' ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                <div className="prose prose-sm prose-invert prose-p:my-1 text-slate-200">
                                   <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                         <div className="flex items-start gap-3">
                            <div className="p-2 bg-cyan-500/20 rounded-full flex-shrink-0"><SparklesIcon className="h-5 w-5 text-cyan-400" /></div>
                             <div className="max-w-md p-3 rounded-lg bg-slate-700 text-slate-200 flex items-center gap-2">
                                <Spinner className="h-4 w-4" />
                                <span className="text-sm">Gemini يفكر...</span>
                             </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                <footer className="p-4 border-t border-slate-700 flex-shrink-0">
                     <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="اطرح سؤالاً عن الأداء..."
                            className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            disabled={isLoading}
                        />
                        <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:bg-slate-600">
                            <PaperAirplaneIcon className="h-5 w-5"/>
                        </button>
                    </div>
                </footer>
                
                 <style>{`
                    @keyframes scale-in { from { transform: scale(0.95) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
                    .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
                    .prose-invert { --tw-prose-body: #d1d5db; --tw-prose-headings: #ffffff; --tw-prose-links: #38bdf8; --tw-prose-bold: #ffffff; }
                 `}</style>
            </div>
        </div>
    );
};