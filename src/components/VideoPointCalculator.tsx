'use client';

import { useState, useEffect } from 'react';
import { X, Calculator, Plus, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const VIDEO_WORK_TYPES = [
  { name: 'Reels Cinematic', points: 3 },
  { name: 'Reels Heavy Edit', points: 2 },
  { name: 'Reels News/Subtitle', points: 0.25 },
  { name: 'Reels Motion', points: 3 },
  { name: 'Timestamp', points: 1 },
  { name: 'Clipping Live/ YT Longform', points: 1 },
  { name: 'LF Cut to Cut', points: 2 },
  { name: 'LF Heavy Edit Di Atas 10 Menit', points: 5 },
  { name: 'LF Heavy Edit Di Bawah 10 Menit', points: 3 },
  { name: 'Modul Cut to Cut Di Atas 10 Menit', points: 2.5 },
  { name: 'Modul Cut to Cut Di Bawah 10 Menit', points: 1.5 },
  { name: 'Modul Heavy Edit', points: 3 },
  { name: 'Motion Simple', points: 1 },
  { name: 'Motion Complex', points: 6 },
  { name: 'Colour Grading', points: 1 },
  { name: 'Shoot Event', points: 3 },
  { name: 'Shoot Rutin', points: 0.5 },
];

interface VideoPointCalculatorProps {
  open: boolean;
  onClose: () => void;
  onApply: (total: number, breakdown: string) => void;
  initialBreakdown?: string;
}

function parseBreakdown(breakdown: string): Record<string, number> {
  const counts: Record<string, number> = {};
  if (!breakdown) return counts;
  const parts = breakdown.split(', ');
  for (const part of parts) {
    const match = part.match(/^(.+)\s+x(\d+)$/);
    if (match) {
      counts[match[1]] = parseInt(match[2]);
    }
  }
  return counts;
}

export default function VideoPointCalculator({ open, onClose, onApply, initialBreakdown }: VideoPointCalculatorProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      setCounts(parseBreakdown(initialBreakdown || ''));
    }
  }, [open, initialBreakdown]);

  if (!open) return null;

  const setCount = (name: string, value: number) => {
    setCounts((prev) => {
      const next = { ...prev };
      if (value <= 0) delete next[name];
      else next[name] = value;
      return next;
    });
  };

  const total = VIDEO_WORK_TYPES.reduce((sum, w) => sum + (counts[w.name] || 0) * w.points, 0);
  const activeItems = VIDEO_WORK_TYPES.filter((w) => (counts[w.name] || 0) > 0);

  const breakdown = activeItems.map((w) => `${w.name} x${counts[w.name]}`).join(', ');

  const handleApply = () => {
    onApply(total, breakdown);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#16161e] border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-400" />
            <h2 className="text-lg font-bold text-white">Kalkulator Poin Video</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Work Type List */}
        <div className="overflow-auto flex-1 p-4">
          <div className="space-y-2">
            {VIDEO_WORK_TYPES.map((w) => {
              const count = counts[w.name] || 0;
              const subtotal = count * w.points;
              return (
                <div
                  key={w.name}
                  className={cn(
                    'flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors',
                    count > 0
                      ? 'bg-brand-400/[0.06] border-brand-400/20'
                      : 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.1]'
                  )}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <p className={cn('text-sm font-medium truncate', count > 0 ? 'text-white' : 'text-gray-400')}>
                      {w.name}
                    </p>
                    <p className="text-[11px] text-gray-500">{w.points} poin/item</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {count > 0 && (
                      <span className="text-xs text-brand-400 font-medium w-12 text-right">{subtotal} pts</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setCount(w.name, count - 1)}
                      disabled={count === 0}
                      className={cn(
                        'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                        count > 0
                          ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                          : 'bg-white/[0.04] text-gray-600 cursor-not-allowed'
                      )}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className={cn('w-8 text-center text-sm font-semibold', count > 0 ? 'text-white' : 'text-gray-600')}>
                      {count}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCount(w.name, count + 1)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with Total */}
        <div className="p-4 border-t border-white/[0.06] flex-shrink-0">
          {activeItems.length > 0 && (
            <div className="mb-3 text-xs text-gray-500 leading-relaxed">
              {activeItems.map((w, i) => (
                <span key={w.name}>
                  {i > 0 && ' + '}
                  <span className="text-gray-400">{w.name}</span>
                  <span className="text-gray-600"> ({counts[w.name]}x{w.points})</span>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Poin</p>
              <p className="text-2xl font-bold text-brand-400">{total}</p>
            </div>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Terapkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function isVideoOutputTemplate(t: { kpi_name: string }): boolean {
  const name = t.kpi_name.toLowerCase();
  return name.includes('total video output') || name.includes('video output');
}
