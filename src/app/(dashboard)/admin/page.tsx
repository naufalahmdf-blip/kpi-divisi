'use client';

import { useEffect, useState, useCallback } from 'react';
import { Shield, Users, Building2, FileSpreadsheet, TrendingUp } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';
import KpiPieChart from '@/components/KpiPieChart';
import EmployeeProfileModal, { EmployeeData } from '@/components/EmployeeProfileModal';
import { cn, getGradeColor, getGradeBg, getMonthName, getCurrentPeriod } from '@/lib/utils';

const DIVISION_COLORS = ['#2A62FF', '#3b82f6', '#10b981', '#f59e0b'];

interface DashboardData {
  divisionSummary: { id: string; name: string; averageScore: number; grade: string; userCount: number }[];
  topEmployees: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    division: string;
    totalScore: number;
    grade: string;
    scores: { kpi_name: string; category: string; weight: number; target: number; actual: number; achievement: number; weighted: number }[];
  }[];
  stats: { totalUsers: number; totalDivisions: number };
}

export default function AdminOverviewPage() {
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
      console.error(err);
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
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const divisionPie = data.divisionSummary.map((d, i) => ({
    name: d.name,
    value: d.averageScore,
    color: DIVISION_COLORS[i % DIVISION_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-brand-300 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Admin Overview</h1>
            <p className="text-gray-500 text-xs sm:text-sm">
              {periodType === 'monthly' ? `${getMonthName(month)} ${year}` : `Minggu ${week}, ${getMonthName(month)} ${year}`}
            </p>
          </div>
        </div>
        <PeriodSelector periodType={periodType} year={year} month={month} week={week} onChange={handlePeriodChange} />
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-400/10 flex items-center justify-center">
            <Users className="w-6 h-6 text-brand-300" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{data.stats.totalUsers}</p>
            <p className="text-xs text-gray-500">Total Karyawan</p>
          </div>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{data.stats.totalDivisions}</p>
            <p className="text-xs text-gray-500">Total Divisi</p>
          </div>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {data.divisionSummary.reduce((s, d) => s + d.userCount, 0)}
            </p>
            <p className="text-xs text-gray-500">User dengan Divisi</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KpiPieChart data={divisionPie} title="Skor Rata-rata Divisi" centerLabel="Divisi" centerValue={data.stats.totalDivisions.toString()} />

        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-brand-300" />
            <h3 className="text-sm font-semibold text-gray-400">Performa Divisi</h3>
          </div>
          <div className="space-y-4">
            {data.divisionSummary.map((div, i) => (
              <div key={div.id}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-medium">{div.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{div.averageScore}</span>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded border font-bold', getGradeBg(div.grade), getGradeColor(div.grade))}>
                      {div.grade}
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
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
      </div>

      {/* Top Employees */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">Top Karyawan</h3>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Rank</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Nama</th>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500">Divisi</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">Skor</th>
                <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500">Grade</th>
              </tr>
            </thead>
            <tbody>
              {data.topEmployees.map((emp, i) => (
                <tr
                  key={emp.id}
                  onClick={() => setSelectedEmployee({
                    id: emp.id,
                    name: emp.name,
                    email: emp.email,
                    avatar_url: emp.avatar_url,
                    division: emp.division,
                    totalScore: emp.totalScore,
                    grade: emp.grade,
                    scores: emp.scores,
                  })}
                  className="border-b border-white/[0.03] cursor-pointer hover:bg-white/[0.03] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-flex w-8 h-8 items-center justify-center rounded-lg text-xs font-bold',
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-gray-400/20 text-gray-300' :
                      i === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/[0.04] text-gray-500'
                    )}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0">
                        {emp.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          emp.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="text-sm text-white font-medium">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{emp.division}</td>
                  <td className="px-4 py-3 text-center text-sm font-bold text-white">{emp.totalScore}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-md border text-xs font-bold', getGradeBg(emp.grade), getGradeColor(emp.grade))}>
                      {emp.grade}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden divide-y divide-white/[0.04]">
          {data.topEmployees.map((emp, i) => (
            <div
              key={emp.id}
              onClick={() => setSelectedEmployee({
                id: emp.id,
                name: emp.name,
                email: emp.email,
                avatar_url: emp.avatar_url,
                division: emp.division,
                totalScore: emp.totalScore,
                grade: emp.grade,
                scores: emp.scores,
              })}
              className="flex items-center gap-3 px-4 py-3.5 cursor-pointer active:bg-white/[0.03] transition-colors"
            >
              <span className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                i === 0 ? 'bg-amber-500/20 text-amber-400' :
                i === 1 ? 'bg-gray-400/20 text-gray-300' :
                i === 2 ? 'bg-orange-500/20 text-orange-400' :
                'bg-white/[0.04] text-gray-500'
              )}>
                {i + 1}
              </span>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0">
                {emp.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  emp.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{emp.name}</p>
                <p className="text-xs text-gray-500">{emp.division}</p>
              </div>
              <div className="text-right flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-white">{emp.totalScore}</span>
                <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-md border', getGradeBg(emp.grade), getGradeColor(emp.grade))}>
                  {emp.grade}
                </span>
              </div>
            </div>
          ))}
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
