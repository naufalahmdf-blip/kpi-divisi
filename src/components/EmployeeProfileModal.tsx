'use client';

import { useEffect } from 'react';
import { X, Mail, Building2 } from 'lucide-react';
import { cn, getGradeColor, getGradeBg, formatPercent } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  Productivity: '#2A62FF',
  Efficiency: '#3b82f6',
  Quality: '#10b981',
  'Creative Development': '#f59e0b',
  Speed: '#8b5cf6',
  Accuracy: '#ef4444',
  Authority: '#06b6d4',
  Volume: '#f97316',
  Lead: '#ec4899',
  Followers: '#14b8a6',
  Security: '#dc2626',
  Recruitment: '#7c3aed',
  Retention: '#0ea5e9',
  Compliance: '#fb923c',
  Engagement: '#a855f7',
  Culture: '#d946ef',
  Absensi: '#22c55e',
};

interface EmployeeScore {
  kpi_name: string;
  category: string;
  weight: number;
  target: number;
  actual: number;
  achievement: number;
  weighted: number;
}

export interface EmployeeData {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  division: string;
  totalScore: number;
  grade: string;
  scores: EmployeeScore[];
}

interface EmployeeProfileModalProps {
  open: boolean;
  onClose: () => void;
  employee: EmployeeData | null;
}

export default function EmployeeProfileModal({ open, onClose, employee }: EmployeeProfileModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEsc);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEsc);
      };
    }
  }, [open, onClose]);

  if (!open || !employee) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="bg-[#16161e] border border-white/[0.08] rounded-2xl w-full max-w-lg shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-0 flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xl overflow-hidden flex-shrink-0">
            {employee.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={employee.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              employee.name.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{employee.name}</h3>
            <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              <span className="truncate">{employee.email}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-0.5">
              <Building2 className="w-3.5 h-3.5" />
              {employee.division}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 -m-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score Summary */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 bg-white/[0.03] rounded-xl p-4 border border-white/[0.06]">
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-1">Total Skor</p>
              <p className="text-2xl font-bold text-white">{employee.totalScore}</p>
            </div>
            <div className={cn('px-4 py-2 rounded-xl border text-lg font-bold', getGradeBg(employee.grade), getGradeColor(employee.grade))}>
              {employee.grade}
            </div>
          </div>
        </div>

        {/* KPI Breakdown */}
        <div className="px-6 pb-6 overflow-y-auto flex-1">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Detail KPI</p>
          <div className="space-y-2">
            {employee.scores.map((s, i) => (
              <div key={i} className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[s.category] || '#6b7280' }} />
                    <span className="text-sm text-white truncate">{s.kpi_name}</span>
                  </div>
                  <span className="text-sm font-bold text-white ml-2">{s.weighted.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>Bobot: {s.weight}%</span>
                  <span>Target: {s.target}</span>
                  <span>Aktual: {s.actual}</span>
                  <span className={cn(s.achievement >= 1 ? 'text-emerald-400' : s.achievement >= 0.7 ? 'text-amber-400' : 'text-red-400')}>
                    {formatPercent(s.achievement)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${s.achievement * 100}%`,
                      backgroundColor: CATEGORY_COLORS[s.category] || '#6b7280',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
