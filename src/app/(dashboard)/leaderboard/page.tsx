'use client';

import { useEffect, useState, useCallback } from 'react';
import { Trophy, Crown, Medal, Award, Users, Building2 } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';
import KpiPieChart from '@/components/KpiPieChart';
import EmployeeProfileModal, { EmployeeData } from '@/components/EmployeeProfileModal';
import DivisionDetailModal from '@/components/DivisionDetailModal';
import { cn, getGradeColor, getGradeBg, getMonthName, getCurrentPeriod } from '@/lib/utils';

const DIVISION_COLORS = ['#2A62FF', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

type LeaderboardType = 'employee' | 'division';

interface EmployeeItem {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  division: string;
  division_id: string;
  totalScore: number;
  grade: string;
  scores: {
    kpi_name: string;
    category: string;
    weight: number;
    target: number;
    actual: number;
    achievement: number;
    weighted: number;
  }[];
}

interface DivisionItem {
  id: string;
  name: string;
  slug: string;
  averageScore: number;
  grade: string;
  userCount: number;
  categoryBreakdown: { category: string; avgScore: number }[];
}

export default function LeaderboardPage() {
  const currentPeriod = getCurrentPeriod();
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('monthly');
  const [year, setYear] = useState(currentPeriod.year);
  const [month, setMonth] = useState(currentPeriod.month);
  const [week, setWeek] = useState(currentPeriod.week);
  const [type, setType] = useState<LeaderboardType>('employee');
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [divisions, setDivisions] = useState<DivisionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type,
        period_type: periodType,
        year: year.toString(),
        month: month.toString(),
      });
      if (periodType === 'weekly') params.set('week', week.toString());

      const res = await fetch(`/api/leaderboard?${params}`);
      const json = await res.json();

      if (json.type === 'employee') {
        setEmployees(json.leaderboard);
      } else {
        setDivisions(json.leaderboard);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [type, periodType, year, month, week]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const handlePeriodChange = (values: { periodType?: string; year?: number; month?: number; week?: number }) => {
    if (values.periodType) setPeriodType(values.periodType as 'weekly' | 'monthly');
    if (values.year) setYear(values.year);
    if (values.month) setMonth(values.month);
    if (values.week) setWeek(values.week);
  };

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Crown className="w-5 h-5 text-amber-400" />;
    if (rank === 1) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 2) return <Award className="w-5 h-5 text-orange-400" />;
    return null;
  };

  const getRankBg = (rank: number) => {
    if (rank === 0) return 'bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/20';
    if (rank === 1) return 'bg-gradient-to-r from-gray-400/10 to-gray-400/5 border-gray-400/20';
    if (rank === 2) return 'bg-gradient-to-r from-orange-500/10 to-orange-500/5 border-orange-500/20';
    return 'bg-white/[0.02] border-white/[0.04]';
  };

  // Pie chart data for division leaderboard
  const divisionPieData = divisions.map((d, i) => ({
    name: d.name,
    value: d.averageScore,
    color: DIVISION_COLORS[i % DIVISION_COLORS.length],
  }));

  // Pie chart for top employees by division
  const employeeByDivision = employees.reduce((acc, e) => {
    acc[e.division] = (acc[e.division] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const employeeDivPie = Object.entries(employeeByDivision).map(([name, value], i) => ({
    name,
    value,
    color: DIVISION_COLORS[i % DIVISION_COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="w-7 h-7 text-amber-400" />
            Leaderboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {periodType === 'monthly' ? `${getMonthName(month)} ${year}` : `Minggu ${week}, ${getMonthName(month)} ${year}`}
          </p>
        </div>
        <PeriodSelector
          periodType={periodType}
          year={year}
          month={month}
          week={week}
          onChange={handlePeriodChange}
        />
      </div>

      {/* Type Toggle */}
      <div className="flex items-center gap-2 bg-[#12121a] border border-white/[0.06] rounded-xl p-1 w-fit">
        <button
          onClick={() => setType('employee')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            type === 'employee' ? 'bg-brand-500 text-white shadow-lg shadow-brand-400/25' : 'text-gray-400 hover:text-white'
          )}
        >
          <Users className="w-4 h-4" />
          Karyawan
        </button>
        <button
          onClick={() => setType('division')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            type === 'division' ? 'bg-brand-500 text-white shadow-lg shadow-brand-400/25' : 'text-gray-400 hover:text-white'
          )}
        >
          <Building2 className="w-4 h-4" />
          Divisi
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Leaderboard List */}
          <div className="lg:col-span-2 space-y-3">
            {type === 'employee' ? (
              employees.length === 0 ? (
                <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-12 text-center">
                  <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Belum ada data karyawan</p>
                </div>
              ) : (
                employees.map((emp, i) => (
                  <div key={emp.id} onClick={() => setSelectedEmployee(emp)} className={cn('flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 hover:scale-[1.01] cursor-pointer', getRankBg(i))}>
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg',
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-gray-400/20 text-gray-300' :
                      i === 2 ? 'bg-orange-500/20 text-orange-400' :
                      'bg-white/[0.06] text-gray-500'
                    )}>
                      {getRankIcon(i) || `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.division}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{emp.totalScore}</p>
                      <p className={cn('text-xs font-semibold', getGradeColor(emp.grade))}>Grade {emp.grade}</p>
                    </div>
                    <div className="w-28 hidden sm:block">
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(emp.totalScore, 100)}%`,
                            backgroundColor: i === 0 ? '#f59e0b' : i === 1 ? '#9ca3af' : i === 2 ? '#f97316' : '#2A62FF',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )
            ) : (
              divisions.length === 0 ? (
                <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-12 text-center">
                  <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Belum ada data divisi</p>
                </div>
              ) : (
                divisions.map((div, i) => (
                  <div key={div.id} onClick={() => setSelectedDivisionId(div.id)} className={cn('p-5 rounded-xl border transition-all duration-200 hover:scale-[1.01] cursor-pointer', getRankBg(i))}>
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                        style={{ backgroundColor: DIVISION_COLORS[i % DIVISION_COLORS.length] + '20', color: DIVISION_COLORS[i % DIVISION_COLORS.length] }}
                      >
                        {getRankIcon(i) || `#${i + 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">{div.name}</p>
                        <p className="text-xs text-gray-500">{div.userCount} anggota</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-white">{div.averageScore}</p>
                        <span className={cn('inline-flex px-2 py-0.5 rounded-md border text-xs font-bold', getGradeBg(div.grade), getGradeColor(div.grade))}>
                          {div.grade}
                        </span>
                      </div>
                    </div>

                    {/* Category Breakdown */}
                    {div.categoryBreakdown.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/[0.04] grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {div.categoryBreakdown.map((cat) => (
                          <div key={cat.category} className="text-center p-2 bg-white/[0.02] rounded-lg">
                            <p className="text-[10px] text-gray-500 mb-1">{cat.category}</p>
                            <p className="text-sm font-bold text-white">{cat.avgScore.toFixed(1)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )
            )}
          </div>

          {/* Sidebar Charts */}
          <div className="space-y-6">
            {type === 'division' && divisionPieData.length > 0 && (
              <KpiPieChart
                data={divisionPieData}
                title="Perbandingan Divisi"
                centerLabel="Divisi"
                centerValue={divisions.length.toString()}
              />
            )}

            {type === 'employee' && employeeDivPie.length > 0 && (
              <KpiPieChart
                data={employeeDivPie}
                title="Distribusi per Divisi"
                centerLabel="Karyawan"
                centerValue={employees.length.toString()}
              />
            )}

            {/* Quick Stats */}
            <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Statistik</h3>
              {type === 'employee' && employees.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Skor Tertinggi</span>
                    <span className="text-sm font-bold text-emerald-400">{employees[0]?.totalScore || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Skor Terendah</span>
                    <span className="text-sm font-bold text-red-400">{employees[employees.length - 1]?.totalScore || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Rata-rata</span>
                    <span className="text-sm font-bold text-blue-400">
                      {(employees.reduce((s, e) => s + e.totalScore, 0) / employees.length).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Total Karyawan</span>
                    <span className="text-sm font-bold text-white">{employees.length}</span>
                  </div>
                </div>
              )}
              {type === 'division' && divisions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Rata-rata Tertinggi</span>
                    <span className="text-sm font-bold text-emerald-400">{divisions[0]?.averageScore || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Rata-rata Terendah</span>
                    <span className="text-sm font-bold text-red-400">{divisions[divisions.length - 1]?.averageScore || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Total Divisi</span>
                    <span className="text-sm font-bold text-white">{divisions.length}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <EmployeeProfileModal
        open={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        employee={selectedEmployee}
      />

      <DivisionDetailModal
        open={!!selectedDivisionId}
        onClose={() => setSelectedDivisionId(null)}
        divisionId={selectedDivisionId}
        periodParams={{ periodType, year, month, week }}
      />
    </div>
  );
}
