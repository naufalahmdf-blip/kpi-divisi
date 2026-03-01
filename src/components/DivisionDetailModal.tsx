'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Users, Loader2 } from 'lucide-react';
import { cn, getGradeColor, getGradeBg } from '@/lib/utils';

interface Member {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  totalScore: number;
  grade: string;
}

interface DivisionDetail {
  division: { id: string; name: string; slug: string };
  averageScore: number;
  grade: string;
  userCount: number;
  categoryBreakdown: { category: string; avgScore: number }[];
  members: Member[];
}

interface DivisionDetailModalProps {
  open: boolean;
  onClose: () => void;
  divisionId: string | null;
  periodParams: { periodType: string; year: number; month: number; week: number };
}

export default function DivisionDetailModal({ open, onClose, divisionId, periodParams }: DivisionDetailModalProps) {
  const [data, setData] = useState<DivisionDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!divisionId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period_type: periodParams.periodType,
        year: periodParams.year.toString(),
        month: periodParams.month.toString(),
      });
      if (periodParams.periodType === 'weekly') params.set('week', periodParams.week.toString());

      const res = await fetch(`/api/divisions/${divisionId}?${params}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [divisionId, periodParams]);

  useEffect(() => {
    if (open && divisionId) {
      fetchData();
    } else {
      setData(null);
    }
  }, [open, divisionId, fetchData]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div
        className="bg-[#16161e] border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {loading || !data ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 pb-4 flex items-start gap-4 border-b border-white/[0.06]">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-brand-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white">{data.division.name}</h3>
                <p className="text-sm text-gray-500">{data.userCount} anggota</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Rata-rata</p>
                  <p className="text-xl font-bold text-white">{data.averageScore}</p>
                </div>
                <div className={cn('px-3 py-1.5 rounded-xl border text-sm font-bold', getGradeBg(data.grade), getGradeColor(data.grade))}>
                  {data.grade}
                </div>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1 -m-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Breakdown */}
            {data.categoryBreakdown.length > 0 && (
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {data.categoryBreakdown.map((cat) => (
                    <div key={cat.category} className="text-center p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                      <p className="text-[10px] text-gray-500 mb-1 truncate">{cat.category}</p>
                      <p className="text-sm font-bold text-white">{cat.avgScore.toFixed(1)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Members */}
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Anggota</p>
              <div className="space-y-2">
                {data.members.map((member, i) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-gray-400/20 text-gray-300' :
                      i === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/[0.06] text-gray-500'
                    )}>
                      {i + 1}
                    </div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                      {member.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        member.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{member.name}</p>
                      <p className="text-xs text-gray-500 truncate">{member.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{member.totalScore}</p>
                      <span className={cn('text-xs font-semibold', getGradeColor(member.grade))}>
                        {member.grade}
                      </span>
                    </div>
                    <div className="w-20 hidden sm:block">
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all duration-500"
                          style={{ width: `${Math.min(member.totalScore, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
