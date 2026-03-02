'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, Users, Trophy, Pencil, TrendingUp } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';
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
  Security: '#dc2626',
  Recruitment: '#7c3aed',
  Retention: '#0ea5e9',
  Compliance: '#fb923c',
  Engagement: '#a855f7',
  Culture: '#d946ef',
  Absensi: '#22c55e',
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

interface DivisionDetail {
  division: { id: string; name: string; slug: string };
  averageScore: number;
  grade: string;
  userCount: number;
  categoryBreakdown: { category: string; avgScore: number }[];
  members: Member[];
}

export default function AdminDivisionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const currentPeriod = getCurrentPeriod();

  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>(
    (searchParams.get('period_type') as 'weekly' | 'monthly') || 'monthly'
  );
  const [year, setYear] = useState(parseInt(searchParams.get('year') || currentPeriod.year.toString()));
  const [month, setMonth] = useState(parseInt(searchParams.get('month') || currentPeriod.month.toString()));
  const [week, setWeek] = useState(parseInt(searchParams.get('week') || currentPeriod.week.toString()));
  const [data, setData] = useState<DivisionDetail | null>(null);
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

      const res = await fetch(`/api/divisions/${id}?${params}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id, periodType, year, month, week]);

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

  const gradeCount = (data?.members || []).reduce((acc, m) => {
    acc[m.grade] = (acc[m.grade] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleMemberClick = (member: Member) => {
    setSelectedEmployee({
      id: member.id,
      name: member.name,
      email: member.email,
      avatar_url: member.avatar_url,
      division: data?.division.name || '',
      totalScore: member.totalScore,
      grade: member.grade,
      scores: member.scores,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">Divisi tidak ditemukan</p>
        <Link href="/admin/divisi" className="text-brand-400 text-sm hover:underline mt-2 inline-block">Kembali</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <Link href="/admin/divisi" className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 hover:text-white transition-colors mb-2">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Kembali
          </Link>
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 sm:w-7 sm:h-7 text-brand-300 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">{data.division.name}</h1>
              <p className="text-gray-500 text-xs sm:text-sm">{periodLabel}</p>
            </div>
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
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-gray-500">Rata-rata Skor</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-2xl font-bold text-white">{data.averageScore}</p>
            <span className={cn('px-2.5 py-1 rounded-lg border text-xs font-bold', getGradeBg(data.grade), getGradeColor(data.grade))}>
              {data.grade}
            </span>
          </div>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-brand-300" />
            <p className="text-xs text-gray-500">Anggota</p>
          </div>
          <p className="text-2xl font-bold text-white">{data.userCount}</p>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-gray-500">Skor Tertinggi</p>
          </div>
          <p className="text-2xl font-bold text-white">{data.members[0]?.totalScore || 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members Table */}
        <div className="lg:col-span-2">
          <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-gray-400">Anggota Divisi</h3>
              <p className="text-xs text-gray-600 mt-0.5">Klik karyawan untuk melihat detail KPI</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {data.members.map((member, i) => (
                <div
                  key={member.id}
                  onClick={() => handleMemberClick(member)}
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer"
                >
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
                  <div className="text-right flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{member.totalScore}</span>
                    <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-md border', getGradeBg(member.grade), getGradeColor(member.grade))}>
                      {member.grade}
                    </span>
                  </div>
                  <Link
                    href={`/admin/kpi/${member.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-brand-500/20 text-gray-500 hover:text-brand-400 transition-colors"
                    title="Edit KPI"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Link>
                  <div className="w-24 hidden sm:block">
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all duration-500"
                        style={{ width: `${Math.min(member.totalScore, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {data.members.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm">Belum ada anggota di divisi ini</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Category Performance Bars */}
          {data.categoryBreakdown.length > 0 && (
            <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-brand-300" />
                <h3 className="text-sm font-semibold text-white">Performa per Kategori</h3>
              </div>
              <div className="space-y-3.5">
                {data.categoryBreakdown.map((cat) => {
                  const pct = Math.min(cat.avgScore, 100);
                  const barColor = cat.avgScore >= 80 ? '#10b981' : cat.avgScore >= 60 ? '#f59e0b' : '#ef4444';
                  const textColor = cat.avgScore >= 80 ? 'text-emerald-400' : cat.avgScore >= 60 ? 'text-amber-400' : 'text-red-400';
                  const catColor = CATEGORY_COLORS[cat.category] || '#6b7280';
                  return (
                    <div key={cat.category}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
                          <span className="text-xs text-gray-300 truncate">{cat.category}</span>
                        </div>
                        <span className={`text-xs font-bold flex-shrink-0 ml-2 ${textColor}`}>
                          {cat.avgScore.toFixed(1)}
                        </span>
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

          {/* Grade Distribution */}
          {data.members.length > 0 && (
            <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Sebaran Grade</h3>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['A', 'B', 'C', 'D'].map((grade) => {
                  const count = gradeCount[grade] || 0;
                  const gradeColors: Record<string, string> = {
                    A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                    B: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                    C: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                    D: 'text-red-400 bg-red-500/10 border-red-500/20',
                  };
                  return (
                    <div key={grade} className={`border rounded-xl p-3 text-center ${gradeColors[grade]}`}>
                      <p className="text-lg font-bold">{count}</p>
                      <p className="text-[10px] font-semibold opacity-80">Grade {grade}</p>
                    </div>
                  );
                })}
              </div>
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
