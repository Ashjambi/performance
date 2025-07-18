import React, { useState, useContext } from 'react';
import { Toaster } from 'react-hot-toast';
import { Dashboard } from './components/Dashboard.tsx';
import { Header } from './components/Header.tsx';
import { AddManagerModal } from './components/AddManagerModal.tsx';
import { EditManagerModal } from './components/EditManagerModal.tsx';
import { AppStateContext } from './context/AppContext.tsx';
import { ROLES } from './data.tsx';
import { ExecutiveDashboard } from './components/ExecutiveDashboard.tsx';
import { AskGemini } from './components/AskGemini.tsx';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { MeetingReportModal } from './components/MeetingReportModal.tsx';
import type { Manager } from './data.tsx';
import { ApiBanner } from './components/ApiBanner.tsx';
import { isAiAvailable, API_KEY_ERROR_MESSAGE } from './services/geminiService.tsx';


const App = () => {
  const { managers, selectedManagerId, currentView, alerts } = useContext(AppStateContext);
  const [isAddManagerModalOpen, setIsAddManagerModalOpen] = useState(false);
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [isAskGeminiOpen, setIsAskGeminiOpen] = useState(false);
  const [reportingManager, setReportingManager] = useState<Manager | null>(null);

  const selectedManager = managers.find(m => m.id === selectedManagerId);
  const managerToEdit = managers.find(m => m.id === editingManagerId);
  
  const handleOpenReport = (managerId: string) => {
    const manager = managers.find(m => m.id === managerId);
    if(manager) setReportingManager(manager);
  };
  
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300">
       <Toaster 
          position="bottom-center"
          toastOptions={{
            className: 'toast-container',
            style: {
              background: '#1e293b',
              color: '#cbd5e1',
              border: '1px solid #334155',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#1e293b',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#1e293b',
              },
            }
          }}
        />

      <Header 
        onAddManager={() => setIsAddManagerModalOpen(true)}
        onEditManager={() => selectedManagerId && setEditingManagerId(selectedManagerId)}
        alerts={alerts}
      />

      <ApiBanner />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 pt-6">
        {currentView === 'manager' ? (
           <>
            {selectedManager ? (
              <Dashboard />
            ) : (
              <div className="text-center py-20">
                <h2 className="text-2xl font-bold text-white">لا يوجد مدير محدد</h2>
                <p className="text-slate-400 mt-2">يرجى إضافة مدير أو تحديده من القائمة أعلاه.</p>
              </div>
            )}
          </>
        ) : (
          <ExecutiveDashboard 
            onEditManager={setEditingManagerId}
            onGenerateReport={handleOpenReport}
           />
        )}
      </main>

      <footer className="text-center p-4 text-slate-500 text-sm">
      </footer>

      {/* --- Modals --- */}
      <AddManagerModal 
        isOpen={isAddManagerModalOpen}
        onClose={() => setIsAddManagerModalOpen(false)}
        roles={ROLES}
      />
       {managerToEdit && (
          <EditManagerModal
            isOpen={!!managerToEdit}
            onClose={() => setEditingManagerId(null)}
            manager={managerToEdit}
            roles={ROLES}
          />
      )}
      
      {reportingManager && (
          <MeetingReportModal
            isOpen={!!reportingManager}
            onClose={() => setReportingManager(null)}
            manager={reportingManager}
          />
      )}


      {/* --- New Conversational AI Components --- */}
      <AskGemini 
        isOpen={isAskGeminiOpen}
        onClose={() => setIsAskGeminiOpen(false)}
      />
      
      <button
        onClick={() => setIsAskGeminiOpen(true)}
        className="fixed bottom-6 end-6 bg-cyan-500 text-white p-4 rounded-full shadow-lg hover:bg-cyan-600 transition-all duration-300 z-40 animate-pulse-slow no-print disabled:bg-slate-600 disabled:opacity-70 disabled:cursor-not-allowed disabled:animate-none"
        title={!isAiAvailable ? API_KEY_ERROR_MESSAGE : "اسأل Gemini"}
        disabled={!isAiAvailable}
      >
        <SparklesIcon className="h-7 w-7" />
      </button>

    </div>
  );
};

export default App;