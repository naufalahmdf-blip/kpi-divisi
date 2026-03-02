'use client';

import { useEffect, useState, useCallback } from 'react';
import { Building2, Crown, Users, Trophy, TrendingUp } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';
import KpiPieChart from '@/components/KpiPieChart';
import EmployeeProfileModal, { EmployeeData } from '@/components/EmployeeProfileModal';
import { cn, getGradeColor, getGradeBg, getMonthName, getCurrentPeriod } from '@/lib/utils';

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
};

interface MemberScore {
  kpi_name: string;
  category: string;
  weight: number;
  target: number;
  actual: number;
  achievement: number;
  weighted: number;
}

interface Member {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  totalScore: number;
  grade: string;
  scores: MemberScore[];
}

interface DivisionData {
  division: { id: string; name: string; slug: string };
  averageScore: number;
  grade: string;
  userCount: number;
  categoryBreakdown: { category: string; avgScore: number }[];
  members: Member[];
  topEmployee: Member | null;
  userRank: number;
  userScore: number;
  userRole: string;
}

export default function DivisiSayaPage() {
  const currentPeriod = getCurrentPeriod();
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('monthly');
  const [year, setYear] = useState(currentPeriod.year);
  const [month, setMonth] = useState(currentPeriod.month);
  const [week, setWeek] = useState(currentPeriod.week);
  const [data, setData] = useState<DivisionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        period_type: periodType,
        year: year.toString(),
        month: month.toString(),
      });
      if (periodType === 'weekly') params.set('week', week.toString());

      const res = await fetch(`/api/my-division?${params}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Gagal memuat data');
        return;
      }

      setData(json);
    } catch {
      setError('Gagal memuat data divisi');
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

  const categoryPieData = (data?.categoryBreakdown || []).map((cat) => ({
    name: cat.category,
    value: Math.round(cat.avgScore * 100) / 100,
    color: CATEGORY_COLORS[cat.category] || '#6b7280',
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat data divisi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const isAdmin = data.userRole === 'admin';

  const handleMemberClick = (member: Member) => {
    if (!isAdmin) return;
    setSelectedEmployee({
      id: member.id,
      name: member.name,
      email: member.email,
      avatar_url: member.avatar_url,
      division: data.division.name,
      totalScore: member.totalScore,
      grade: member.grade,
      scores: member.scores,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-brand-300 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Divisi Saya</h1>
            <p className="text-gray-500 text-xs sm:text-sm">
              {data.division.name} &middot; {periodLabel}
            </p>
          </div>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-brand-300" />
            <p className="text-xs text-gray-500">Rata-rata Skor</p>
          </div>
          <p className="text-2xl font-bold text-white">{data.averageScore}</p>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-gray-500">Grade Divisi</p>
          </div>
          <span className={cn('inline-flex px-3 py-1.5 rounded-xl border text-lg font-bold', getGradeBg(data.grade), getGradeColor(data.grade))}>
            {data.grade}
          </span>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-gray-500">Total Anggota</p>
          </div>
          <p className="text-2xl font-bold text-white">{data.userCount}</p>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-gray-500">Peringkat Anda</p>
          </div>
          <p className="text-2xl font-bold text-white">
            #{data.userRank > 0 ? data.userRank : '-'}
            <span className="text-sm text-gray-500 font-normal ml-1">/ {data.userCount}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Employee + Members */}
        <div className="lg:col-span-2 space-y-6">
          {/* Top #1 Employee */}
          {data.topEmployee && (
            <div
              onClick={() => isAdmin && setSelectedEmployee({ id: data.topEmployee!.id, name: data.topEmployee!.name, email: data.topEmployee!.email, avatar_url: data.topEmployee!.avatar_url, division: data.division.name, totalScore: data.topEmployee!.totalScore, grade: data.topEmployee!.grade, scores: data.topEmployee!.scores })}
              className={cn("bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-6", isAdmin && "cursor-pointer hover:border-amber-500/40 transition-colors")}
            >
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-semibold text-amber-400">Top #1 Karyawan</h3>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                  {data.topEmployee.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.topEmployee.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    data.topEmployee.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-white">{data.topEmployee.name}</p>
                  <p className="text-sm text-gray-400">Skor: {data.topEmployee.totalScore}</p>
                </div>
                <div className={cn('px-4 py-2 rounded-xl border text-lg font-bold', getGradeBg(data.topEmployee.grade), getGradeColor(data.topEmployee.grade))}>
                  {data.topEmployee.grade}
                </div>
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-gray-400">Semua Anggota</h3>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {data.members.map((member, i) => (
                <div
                  key={member.id}
                  onClick={() => handleMemberClick(member)}
                  className={cn("flex items-center gap-3 px-6 py-3.5 hover:bg-white/[0.02] transition-colors", isAdmin && "cursor-pointer")}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold',
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
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{member.totalScore}</span>
                    <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-md border', getGradeBg(member.grade), getGradeColor(member.grade))}>
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
        </div>

        {/* Pie Chart */}
        <div>
          {categoryPieData.length > 0 && (
            <KpiPieChart
              data={categoryPieData}
              title="Skor per Kategori"
              centerLabel="Rata-rata"
              centerValue={data.averageScore.toString()}
            />
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
