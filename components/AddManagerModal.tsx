import React, { useState, useContext } from 'react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import type { ManagerRole, ManagerRoleValue } from '../data.tsx';
import { AppDispatchContext } from '../context/AppContext.tsx';
import { toast } from 'react-hot-toast';

type AddManagerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  roles: Record<ManagerRole, ManagerRoleValue>;
};

export const AddManagerModal = ({ isOpen, onClose, roles }: AddManagerModalProps) => {
  const dispatch = useContext(AppDispatchContext);
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<ManagerRole>('RAMP');


  if (!isOpen) return null;

  const handleAddClick = () => {
    if (name.trim() && role && department.trim()) {
      const newManagerPayload = { name: name.trim(), department: department.trim(), role };
      dispatch({ type: 'ADD_MANAGER', payload: newManagerPayload });
      toast.success(`تم إضافة المدير "${name.trim()}" بنجاح.`);
      setName('');
      setDepartment('');
      setRole('RAMP');
      onClose();
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddClick();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md flex flex-col transition-transform duration-300 scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-white">إضافة مدير جديد</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="إغلاق"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>

        <form onSubmit={(e) => { e.preventDefault(); handleAddClick(); }} onKeyDown={handleKeyDown}>
          <div className="p-6 space-y-4 text-slate-300">
             <div>
                <label htmlFor="manager-name" className="block text-sm font-medium text-slate-400 mb-2">
                اسم المدير
                </label>
                <input
                id="manager-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: عبدالله العتيبي"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                autoFocus
                />
            </div>
            <div>
                <label htmlFor="manager-department" className="block text-sm font-medium text-slate-400 mb-2">
                القسم
                </label>
                <input
                id="manager-department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="مثال: عمليات الساحة"
                className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                />
            </div>
             <div>
                <label htmlFor="manager-role" className="block text-sm font-medium text-slate-400 mb-2">
                    الدور الوظيفي (يحدد مؤشرات الأداء)
                </label>
                <select
                    id="manager-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as ManagerRole)}
                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                >
                    {(Object.keys(roles) as ManagerRole[]).map(roleKey => (
                        <option key={roleKey} value={roleKey}>
                            {roles[roleKey]}
                        </option>
                    ))}
                </select>
             </div>
          </div>

          <footer className="p-4 border-t border-slate-700 flex justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={!name.trim() || !department.trim()}
              className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors disabled:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              إضافة
            </button>
          </footer>
        </form>
      </div>
      <style>{`
        @keyframes scale-in {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};