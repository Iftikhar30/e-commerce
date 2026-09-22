import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-neutral-900 text-white px-4 py-2.5 rounded-xl shadow-lg border border-neutral-800 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
      <span>{message}</span>
    </div>
  );
};
