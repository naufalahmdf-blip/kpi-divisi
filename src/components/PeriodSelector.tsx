'use client';

import { ChevronDown } from 'lucide-react';
import { getMonthName } from '@/lib/utils';

interface PeriodSelectorProps {
  periodType: 'weekly' | 'monthly';
  year: number;
  month: number;
  week: number;
  onChange: (values: { periodType?: string; year?: number; month?: number; week?: number }) => void;
  hideToggle?: boolean;
}

export default function PeriodSelector({ periodType, year, month, week, onChange, hideToggle }: PeriodSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Period Type */}
      {!hideToggle && (
        <div className="relative">
          <select
            value={periodType}
            onChange={(e) => onChange({ periodType: e.target.value })}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-brand-400/50 cursor-pointer"
          >
            <option value="monthly">Bulanan</option>
            <option value="weekly">Mingguan</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      )}

      {/* Year */}
      <div className="relative">
        <select
          value={year}
          onChange={(e) => onChange({ year: parseInt(e.target.value) })}
          className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-brand-400/50 cursor-pointer"
        >
          {[2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>

      {/* Month */}
      <div className="relative">
        <select
          value={month}
          onChange={(e) => onChange({ month: parseInt(e.target.value) })}
          className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-brand-400/50 cursor-pointer"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{getMonthName(m)}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>

      {/* Week (only for weekly) */}
      {periodType === 'weekly' && (
        <div className="relative">
          <select
            value={week}
            onChange={(e) => onChange({ week: parseInt(e.target.value) })}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-10 text-sm text-white focus:outline-none focus:border-brand-400/50 cursor-pointer"
          >
            {[1, 2, 3, 4, 5].map((w) => (
              <option key={w} value={w}>Minggu {w}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      )}
    </div>
  );
}
