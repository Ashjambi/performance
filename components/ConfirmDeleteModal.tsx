import React from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid';

type ConfirmDeleteModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
};

export const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, title, message }: ConfirmDeleteModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60] transition-opacity duration-300"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md flex flex-col transition-transform duration-300 scale-95 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="إغلاق"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </header>

        <div className="p-6 text-slate-300">
          <p>{message}</p>
        </div>

        <footer className="p-4 border-t border-slate-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            تأكيد الحذف
          </button>
        </footer>
      </div>
    </div>
  );
};