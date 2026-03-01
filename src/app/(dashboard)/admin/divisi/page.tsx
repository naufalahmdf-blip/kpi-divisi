'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Building2, Users, ChevronRight, TrendingUp } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';
import { cn, getGradeColor, getGradeBg, getMonthName, getCurrentPeriod } from '@/lib/utils';

const CARD_COLORS = [
  { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/20', icon: 'text-blue-400' },
  { bg: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/20', icon: 'text-emerald-400' },
  { bg: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/20', icon: 'text-amber-400' },
  { bg: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/20', icon: 'text-purple-400' },
  { bg: 'from-pink-500/20 to-pink-600/10', border: 'border-pink-500/20', icon: 'text-pink-400' },
  { bg: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/20', icon: 'text-cyan-400' },
];

interface DivisionItem {
  id: string;
  name: string;
  slug: string;
  averageScore: number;
  grade: string;
  userCount: number;
  categoryBreakdown: { category: string; avgScore: number }[];
}

export default function AdminDivisiBrowsePage() {
  const currentPeriod = getCurrentPeriod();
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('monthly');
  const [year, setYear] = useState(currentPeriod.year);
  const [month, setMonth] = useState(currentPeriod.month);
  const [week, setWeek] = useState(currentPeriod.week);
  const [divisions, setDivisions] = useState<DivisionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: 'division',
        period_type: periodType,
        year: year.toString(),
        month: month.toString(),
      });
      if (periodType === 'weekly') params.set('week', week.toString());

      const res = await fetch(`/api/leaderboard?${params}`);
      const json = await res.json();
      setDivisions(json.leaderboard || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [periodType, year, month, week]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (values: { periodType?: string; year?: number; month?: number; week?: number }) => {
    if (values.periodType) setPeriodType(values.periodType as 'weekly' | 'monthly');
    if (values.year) setYear(values.year);
    if (values.month) setMonth(values.month);
    if (values.week) setWeek(values.week);
  };

  const periodLabel = periodType === 'monthly'
    ? `${getMonthName(month)} ${year}`
    : `Minggu ${week}, ${getMonthName(month)} ${year}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-brand-300" />
            Performa Divisi
          </h1>
          <p className="text-gray-500 text-sm mt-1">{periodLabel}</p>
        </div>
        <PeriodSelector
          periodType={periodType}
          year={year}
          month={month}
          week={week}
          onChange={handlePeriodChange}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : divisions.length === 0 ? (
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Belum ada data divisi</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {divisions.map((div, i) => {
            const style = CARD_COLORS[i % CARD_COLORS.length];
            return (
              <Link
                key={div.id}
                href={`/admin/divisi/${div.id}?period_type=${periodType}&year=${year}&month=${month}&week=${week}`}
                className={cn(
                  'group bg-gradient-to-br rounded-2xl border p-6 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg',
                  style.bg, style.border
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center', style.icon)}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{div.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Users className="w-3 h-3" />
                        {div.userCount} anggota
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <p className="text-3xl font-bold text-white">{div.averageScore}</p>
                  <span className={cn('px-2.5 py-1 rounded-lg border text-xs font-bold', getGradeBg(div.grade), getGradeColor(div.grade))}>
                    Grade {div.grade}
                  </span>
                </div>

                {div.categoryBreakdown.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {div.categoryBreakdown.map((cat) => (
                      <div key={cat.category} className="text-center p-2 bg-black/20 rounded-lg">
                        <p className="text-[10px] text-gray-500 truncate">{cat.category}</p>
                        <p className="text-xs font-bold text-white">{cat.avgScore.toFixed(1)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
