'use client';

import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Hapus',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !loading) onClose();
      };
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [open, onClose, loading]);

  if (!open) return null;

  const iconColor = variant === 'danger' ? 'text-red-400' : variant === 'warning' ? 'text-amber-400' : 'text-brand-300';
  const iconBg = variant === 'danger' ? 'bg-red-500/10' : variant === 'warning' ? 'bg-amber-500/10' : 'bg-brand-500/10';
  const btnClass =
    variant === 'danger'
      ? 'bg-red-500 hover:bg-red-400 text-white'
      : variant === 'warning'
        ? 'bg-amber-500 hover:bg-amber-400 text-black'
        : 'bg-brand-500 hover:bg-brand-400 text-white';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={() => !loading && onClose()}>
      <div
        className="bg-[#16161e] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
              {variant === 'danger' ? (
                <Trash2 className={cn('w-5 h-5', iconColor)} />
              ) : (
                <AlertTriangle className={cn('w-5 h-5', iconColor)} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-white">{title}</h3>
              <p className="text-sm text-gray-400 mt-1 leading-relaxed">{description}</p>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="text-gray-500 hover:text-white transition-colors p-1 -m-1 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 pb-6">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn('flex-1 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70', btnClass)}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
