'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Building2, Trophy, TrendingUp, Medal, Crown, ChevronRight, Clock } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';
import KpiPieChart from '@/components/KpiPieChart';
import EmployeeProfileModal, { EmployeeData } from '@/components/EmployeeProfileModal';
import { cn, getGrade, getGradeColor, getGradeBg, getMonthName, getCurrentPeriod } from '@/lib/utils';

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

const GRADE_COLORS_HEX: Record<string, string> = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
};

const DIV_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#f43f5e', '#6366f1'];

interface DashboardData {
  user: {
    id: string;
    full_name: string;
    role: string;
    division_name?: string;
    score: number | null;
    grade: string | null;
    scores: { kpi_name: string; category: string; weighted: number; achievement: number; weight: number }[];
  };
  divisionSummary: { id: string; name: string; averageScore: number; grade: string; userCount: number }[];
  topEmployees: { id: string; name: string; email: string; avatar_url: string | null; division: string; totalScore: number; grade: string; scores: { kpi_name: string; category: string; weight: number; target: number; actual: number; achievement: number; weighted: number }[] }[];
  lateEmployees: { id: string; name: string; division: string; lateRate: number; terlambat: number; hadir: number }[];
  stats: { totalUsers: number; totalDivisions: number };
}

export default function DashboardPage() {
  const currentPeriod = getCurrentPeriod();
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('monthly');
  const [year, setYear] = useState(currentPeriod.year);
  const [month, setMonth] = useState(currentPeriod.month);
  const [week, setWeek] = useState(currentPeriod.week);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        period_type: periodType,
        year: year.toString(),
        month: month.toString(),
      });
      if (periodType === 'weekly') params.set('week', week.toString());

      const res = await fetch(`/api/dashboard?${params}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
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

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat data...</p>
        </div>
      </div>
    );
  }

  const isAdmin = data.user.role === 'admin';
  const periodLabel = periodType === 'monthly'
    ? `${getMonthName(month)} ${year}`
    : `Minggu ${week}, ${getMonthName(month)} ${year}`;

  // ═══════════════════════════════════════════
  //  ADMIN DASHBOARD
  // ═══════════════════════════════════════════
  if (isAdmin) {
    const sortedDivisions = [...data.divisionSummary].sort((a, b) => b.averageScore - a.averageScore);
    const activeDivisions = sortedDivisions.filter(d => d.userCount > 0);
    const companyAvg = activeDivisions.length > 0
      ? Math.round(activeDivisions.reduce((sum, d) => sum + d.averageScore, 0) / activeDivisions.length * 100) / 100
      : 0;
    const companyGrade = getGrade(companyAvg, 120);
    const bestDivision = activeDivisions[0] || null;
    const maxScore = Math.max(...sortedDivisions.map(d => d.averageScore), 1);
    const topOne = data.topEmployees[0] || null;
    const topRest = data.topEmployees.slice(1);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">{periodLabel}</p>
          </div>
          <PeriodSelector
            periodType={periodType}
            year={year}
            month={month}
            week={week}
            onChange={handlePeriodChange}
          />
        </div>

        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-500/15 via-brand-600/5 to-purple-500/10 border border-brand-500/15 rounded-2xl p-6 lg:p-8">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl" />
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs text-brand-300/80 uppercase tracking-wider font-medium mb-2">Rata-rata Skor Perusahaan</p>
              <div className="flex items-center gap-4">
                <p className="text-5xl font-bold text-white">{companyAvg}</p>
                <div>
                  <span className={cn('px-3 py-1.5 rounded-xl border text-sm font-bold', getGradeBg(companyGrade), getGradeColor(companyGrade))}>
                    Grade {companyGrade}
                  </span>
                  <p className="text-xs text-gray-500 mt-1.5">dari 120 poin</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6 lg:gap-8">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.06] backdrop-blur-sm flex items-center justify-center mx-auto mb-1.5">
                  <Users className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-xl font-bold text-white">{data.stats.totalUsers}</p>
                <p className="text-[11px] text-gray-500">Karyawan</p>
              </div>
              <div className="h-12 w-px bg-white/[0.06]" />
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.06] backdrop-blur-sm flex items-center justify-center mx-auto mb-1.5">
                  <Building2 className="w-5 h-5 text-amber-400" />
                </div>
                <p className="text-xl font-bold text-white">{data.stats.totalDivisions}</p>
                <p className="text-[11px] text-gray-500">Divisi</p>
              </div>
              <div className="h-12 w-px bg-white/[0.06]" />
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.06] backdrop-blur-sm flex items-center justify-center mx-auto mb-1.5">
                  <Crown className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-sm font-bold text-white truncate max-w-[100px]">{bestDivision?.name || '-'}</p>
                <p className="text-[11px] text-gray-500">Divisi Terbaik</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Division Performance */}
          <div className="lg:col-span-2 bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="p-6 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-300" />
                  <h3 className="text-sm font-semibold text-white">Performa Divisi</h3>
                </div>
                <Link href="/admin/divisi" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Lihat Semua &rarr;
                </Link>
              </div>
            </div>
            <div>
              {sortedDivisions.map((div, i) => {
                const color = DIV_COLORS[i % DIV_COLORS.length];
                return (
                  <Link
                    key={div.id}
                    href={`/admin/divisi/${div.id}?period_type=${periodType}&year=${year}&month=${month}&week=${week}`}
                    className="flex items-center gap-3 pr-5 hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className="w-1 self-stretch rounded-r-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ml-2 my-3',
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-gray-400/20 text-gray-300' :
                      i === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/[0.06] text-gray-500'
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0 py-3">
                      <p className="text-sm font-medium text-white truncate">{div.name}</p>
                      <p className="text-[11px] text-gray-500">{div.userCount} anggota</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-white">{div.averageScore}</span>
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md border', getGradeBg(div.grade), getGradeColor(div.grade))}>
                        {div.grade}
                      </span>
                    </div>
                    <div className="w-24 hidden sm:block flex-shrink-0">
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min((div.averageScore / maxScore) * 100, 100)}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                  </Link>
                );
              })}
              {sortedDivisions.length === 0 && (
                <div className="py-10 text-center">
                  <Building2 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Belum ada data divisi</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Karyawan */}
          <div className="space-y-4">
            {/* #1 Spotlight */}
            {topOne && (
              <div
                onClick={() => setSelectedEmployee({ id: topOne.id, name: topOne.name, email: topOne.email, avatar_url: topOne.avatar_url, division: topOne.division, totalScore: topOne.totalScore, grade: topOne.grade, scores: topOne.scores })}
                className="relative overflow-hidden bg-gradient-to-br from-amber-500/15 to-amber-600/5 border border-amber-500/20 rounded-2xl p-5 cursor-pointer hover:border-amber-500/40 transition-colors"
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400">#1 Karyawan Terbaik</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 overflow-hidden">
                      {topOne.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={topOne.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        topOne.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-white truncate">{topOne.name}</p>
                      <p className="text-xs text-gray-400">{topOne.division}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-2xl font-bold text-white">{topOne.totalScore}</span>
                    <span className={cn('px-2 py-0.5 rounded-lg border text-xs font-bold', getGradeBg(topOne.grade), getGradeColor(topOne.grade))}>
                      {topOne.grade}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* #2-5 List */}
            <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">Top Karyawan</h3>
                </div>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {topRest.map((emp, i) => (
                  <div
                    key={emp.id}
                    onClick={() => setSelectedEmployee({ id: emp.id, name: emp.name, email: emp.email, avatar_url: emp.avatar_url, division: emp.division, totalScore: emp.totalScore, grade: emp.grade, scores: emp.scores })}
                    className="flex items-center gap-2.5 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <div className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] flex-shrink-0',
                      i === 0 ? 'bg-gray-400/20 text-gray-300' :
                      i === 1 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/[0.04] text-gray-500'
                    )}>
                      #{i + 2}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0 overflow-hidden">
                      {emp.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        emp.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{emp.name}</p>
                      <p className="text-[10px] text-gray-500">{emp.division}</p>
                    </div>
                    <div className="text-right flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-sm font-bold text-white">{emp.totalScore}</span>
                      <span className={cn('text-[10px] font-semibold px-1 py-0.5 rounded border', getGradeBg(emp.grade), getGradeColor(emp.grade))}>
                        {emp.grade}
                      </span>
                    </div>
                  </div>
                ))}
                {data.topEmployees.length === 0 && (
                  <div className="py-8 text-center">
                    <Trophy className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Belum ada data</p>
                  </div>
                )}
              </div>
            </div>

            {/* Karyawan Sering Terlambat */}
            {periodType === 'monthly' && (
              <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-400" />
                  <h3 className="text-sm font-semibold text-white">Sering Terlambat</h3>
                  <span className="ml-auto text-xs text-gray-500">{periodLabel}</span>
                </div>
                {data.lateEmployees.length === 0 ? (
                  <div className="py-8 text-center">
                    <Clock className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Tidak ada data</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {data.lateEmployees.map((emp, i) => (
                      <div key={emp.id} className="flex items-center gap-2.5 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] flex-shrink-0',
                          i === 0 ? 'bg-red-500/20 text-red-400' :
                          i === 1 ? 'bg-orange-500/20 text-orange-400' :
                          i === 2 ? 'bg-amber-500/20 text-amber-400' :
                          'bg-white/[0.04] text-gray-500'
                        )}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{emp.name}</p>
                          <p className="text-[10px] text-gray-500">{emp.division}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn(
                            'text-sm font-bold',
                            emp.lateRate > 15 ? 'text-red-400' : emp.lateRate > 5 ? 'text-amber-400' : 'text-emerald-400'
                          )}>
                            {emp.lateRate.toFixed(1)}%
                          </p>
                          <p className="text-[10px] text-gray-500">{emp.terlambat}/{emp.hadir} hari</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <EmployeeProfileModal
          open={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          employee={selectedEmployee}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════
  //  USER DASHBOARD
  // ═══════════════════════════════════════════

  const DIVISION_COLORS = ['#2A62FF', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];
  const divisionPieData = data.divisionSummary.map((d, i) => ({
    name: d.name,
    value: d.averageScore,
    color: DIVISION_COLORS[i % DIVISION_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Halo, {data.user.full_name}</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">{periodLabel}</p>
        </div>
        <PeriodSelector
          periodType={periodType}
          year={year}
          month={month}
          week={week}
          onChange={handlePeriodChange}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.user.score !== null && (
          <>
            <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-400/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-brand-300" />
                </div>
                <p className="text-sm text-gray-400">Total Skor</p>
              </div>
              <p className="text-3xl font-bold text-white">{data.user.score}</p>
              <p className="text-xs text-gray-500 mt-1">dari 100</p>
            </div>
            <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Medal className="w-5 h-5 text-emerald-400" />
                </div>
                <p className="text-sm text-gray-400">Grade</p>
              </div>
              <div className={cn('inline-flex items-center px-4 py-2 rounded-xl border text-2xl font-bold', getGradeBg(data.user.grade!), getGradeColor(data.user.grade!))}>
                {data.user.grade}
              </div>
            </div>
          </>
        )}

        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-sm text-gray-400">Total Karyawan</p>
          </div>
          <p className="text-3xl font-bold text-white">{data.stats.totalUsers}</p>
        </div>

        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-sm text-gray-400">Total Divisi</p>
          </div>
          <p className="text-3xl font-bold text-white">{data.stats.totalDivisions}</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* KPI Achievement Bars */}
        {data.user.scores?.length > 0 && (
          <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-300" />
                <h3 className="text-sm font-semibold text-white">Pencapaian KPI</h3>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />≥100%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />70-99%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />&lt;70%</span>
              </div>
            </div>
            <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
              {data.user.scores.map((kpi, i) => {
                const pct = Math.min(kpi.achievement, 100);
                const barColor = kpi.achievement >= 100 ? '#10b981' : kpi.achievement >= 70 ? '#f59e0b' : '#ef4444';
                const textColor = kpi.achievement >= 100 ? 'text-emerald-400' : kpi.achievement >= 70 ? 'text-amber-400' : 'text-red-400';
                const catColor = CATEGORY_COLORS[kpi.category] || '#6b7280';
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                        <span className="text-xs sm:text-sm text-white truncate">{kpi.kpi_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-xs font-bold ${textColor}`}>{kpi.achievement.toFixed(0)}%</span>
                        <span className="text-[10px] text-gray-600">({kpi.weighted.toFixed(1)} pts)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <KpiPieChart
          data={divisionPieData}
          title="Rata-rata Skor per Divisi"
          centerLabel="Divisi"
          centerValue={data.stats.totalDivisions.toString()}
        />

        {/* Division Cards */}
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-4 sm:p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3 sm:mb-4">Performa Divisi</h3>
          <div className="space-y-2 sm:space-y-3">
            {data.divisionSummary.map((div, i) => (
              <div key={div.id} className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-3 bg-white/[0.02] rounded-xl">
                <div
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0"
                  style={{ backgroundColor: DIVISION_COLORS[i % DIVISION_COLORS.length] + '20', color: DIVISION_COLORS[i % DIVISION_COLORS.length] }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white truncate">{div.name}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{div.userCount} anggota</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs sm:text-sm font-bold text-white">{div.averageScore}</p>
                  <p className={cn('text-[10px] sm:text-xs font-semibold', getGradeColor(div.grade))}>Grade {div.grade}</p>
                </div>
                <div className="w-16 sm:w-24 h-1.5 sm:h-2 bg-white/[0.06] rounded-full overflow-hidden hidden sm:block flex-shrink-0">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(div.averageScore, 100)}%`,
                      backgroundColor: DIVISION_COLORS[i % DIVISION_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Employees */}
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-gray-400">Top 5 Karyawan</h3>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {data.topEmployees.map((emp, i) => (
              <div key={emp.id} className="flex items-center gap-2.5 sm:gap-4 p-2.5 sm:p-3 bg-white/[0.02] rounded-xl">
                <div className={cn(
                  'w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0',
                  i === 0 ? 'bg-amber-500/20 text-amber-400' :
                  i === 1 ? 'bg-gray-400/20 text-gray-300' :
                  i === 2 ? 'bg-orange-500/20 text-orange-400' :
                  'bg-white/[0.04] text-gray-500'
                )}>
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-white truncate">{emp.name}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500">{emp.division}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs sm:text-sm font-bold text-white">{emp.totalScore}</p>
                  <p className={cn('text-[10px] sm:text-xs font-semibold', getGradeColor(emp.grade))}>Grade {emp.grade}</p>
                </div>
              </div>
            ))}
            {data.topEmployees.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Belum ada data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
