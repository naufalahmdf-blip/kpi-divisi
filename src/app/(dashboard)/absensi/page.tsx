'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarCheck, Users, Building2, Search } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';
import { cn, getMonthName, getCurrentPeriod } from '@/lib/utils';
import { AttendanceEntry } from '@/lib/attendance';

interface EmployeeAttendance {
  id: string;
  full_name: string;
  avatar_url: string | null;
  division: string;
  attendance: (AttendanceEntry & { hari_kerja: number }) | null;
}

interface AbsensiData {
  users: EmployeeAttendance[];
  period: { year: number; month: number };
}

const RADIUS = 26;
const CIRC = 2 * Math.PI * RADIUS;

function DonutRing({
  fillPct,
  color,
  label,
  valueText,
  target,
}: {
  fillPct: number;
  color: string;
  label: string;
  valueText: string;
  target: string;
}) {
  const offset = CIRC * (1 - Math.min(Math.max(fillPct, 0), 1));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[72px] h-[72px]">
        <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
          <circle cx="32" cy="32" r={RADIUS} fill="none" stroke="#1e1e2e" strokeWidth="6" />
          <circle
            cx="32" cy="32" r={RADIUS} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white leading-none">{valueText}</span>
        </div>
      </div>
      <p className="text-[10px] font-medium text-gray-300">{label}</p>
      <p className="text-[9px] text-gray-600">target {target}</p>
    </div>
  );
}

export default function AbsensiPage() {
  const currentPeriod = getCurrentPeriod();
  const [year, setYear] = useState(currentPeriod.year);
  const [month, setMonth] = useState(currentPeriod.month);
  const [data, setData] = useState<AbsensiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/absensi?year=${year}&month=${month}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (values: { year?: number; month?: number }) => {
    if (values.year) setYear(values.year);
    if (values.month) setMonth(values.month);
  };

  const divisions = data ? [...new Set(data.users.map((u) => u.division))].sort() : [];

  const filtered = (data?.users || []).filter((u) => {
    const matchSearch = u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.division.toLowerCase().includes(search.toLowerCase());
    const matchDiv = divisionFilter === '' || u.division === divisionFilter;
    return matchSearch && matchDiv;
  });

  const totalUsers = data?.users.length || 0;
  const filledCount = (data?.users || []).filter((u) => u.attendance !== null).length;
  const periodLabel = `${getMonthName(month)} ${year}`;

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat data absensi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Absensi Karyawan</h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">{periodLabel}</p>
        </div>
        <PeriodSelector
          periodType="monthly"
          year={year}
          month={month}
          week={1}
          onChange={handlePeriodChange}
          hideToggle
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-brand-400/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-brand-300" />
            </div>
            <p className="text-xs text-gray-400">Total</p>
          </div>
          <p className="text-3xl font-bold text-white">{totalUsers}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">karyawan</p>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-gray-400">Sudah Diisi</p>
          </div>
          <p className="text-3xl font-bold text-white">{filledCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">dari {totalUsers}</p>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-xs text-gray-400">Belum Diisi</p>
          </div>
          <p className="text-3xl font-bold text-white">{totalUsers - filledCount}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">karyawan</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari nama karyawan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#12121a] border border-white/[0.06] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500/50 transition-colors"
          />
        </div>
        <div className="relative">
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="appearance-none bg-[#12121a] border border-white/[0.06] rounded-xl px-4 py-2.5 pr-9 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors cursor-pointer w-full sm:w-auto"
          >
            <option value="">Semua Divisi</option>
            {divisions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Employee Cards Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((emp) => {
            const att = emp.attendance;
            const hasData = att !== null && att.hari_kerja > 0;

            const tidakHadir = hasData
              ? Math.max(0, att!.hari_kerja - att!.hadir - att!.sakit - att!.cuti)
              : 0;
            const kehadiranDenom = hasData ? att!.hadir + tidakHadir : 0;
            const attendanceRate = hasData && kehadiranDenom > 0
              ? (att!.hadir / kehadiranDenom) * 100
              : 0;
            const tepatWaktuRate = hasData && att!.hadir > 0
              ? ((att!.hadir - att!.terlambat) / att!.hadir) * 100
              : 0;

            const attendanceColor =
              attendanceRate >= 95 ? '#10b981' : attendanceRate >= 80 ? '#f59e0b' : '#ef4444';
            const tepatWaktuColor =
              tepatWaktuRate >= 90 ? '#10b981' : tepatWaktuRate >= 75 ? '#f59e0b' : '#ef4444';

            const stats = hasData
              ? [
                  { label: 'Kerja', value: att!.hari_kerja, color: 'text-gray-300' },
                  { label: 'Hadir', value: att!.hadir, color: 'text-emerald-400' },
                  { label: 'Telat', value: att!.terlambat, color: att!.terlambat > 0 ? 'text-amber-400' : 'text-gray-400' },
                  { label: 'Sakit', value: att!.sakit, color: att!.sakit > 0 ? 'text-blue-400' : 'text-gray-400' },
                  { label: 'Cuti', value: att!.cuti, color: att!.cuti > 0 ? 'text-purple-400' : 'text-gray-400' },
                  { label: 'Alpha', value: tidakHadir, color: tidakHadir > 0 ? 'text-red-400' : 'text-gray-400' },
                ]
              : [];

            return (
              <div
                key={emp.id}
                className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col"
              >
                {/* Card Header */}
                <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                    {emp.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      emp.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate leading-tight">{emp.full_name}</p>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5">{emp.division}</p>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0',
                      hasData
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-white/[0.03] text-gray-600 border-white/[0.06]'
                    )}
                  >
                    {hasData ? 'Terisi' : 'Kosong'}
                  </span>
                </div>

                {/* Content */}
                {hasData ? (
                  <>
                    {/* Divider */}
                    <div className="h-px bg-white/[0.04] mx-4" />

                    {/* Donut Charts */}
                    <div className="flex items-center justify-around px-4 py-4 gap-2">
                      <DonutRing
                        fillPct={attendanceRate / 100}
                        color={attendanceColor}
                        label="Kehadiran"
                        valueText={`${attendanceRate.toFixed(0)}%`}
                        target="≥95%"
                      />
                      <div className="flex flex-col items-center gap-1 text-center px-1">
                        <p className="text-xs text-gray-500">{att!.hadir}</p>
                        <p className="text-[9px] text-gray-700">hadir</p>
                        <div className="h-px w-6 bg-white/[0.08] my-0.5" />
                        <p className="text-xs text-gray-500">{att!.hari_kerja}</p>
                        <p className="text-[9px] text-gray-700">hari kerja</p>
                      </div>
                      <DonutRing
                        fillPct={tepatWaktuRate / 100}
                        color={tepatWaktuColor}
                        label="Tepat Waktu"
                        valueText={`${tepatWaktuRate.toFixed(0)}%`}
                        target="≥90%"
                      />
                    </div>

                    {/* Stats row */}
                    <div className="border-t border-white/[0.04] grid grid-cols-6 mt-auto">
                      {stats.map((s) => (
                        <div
                          key={s.label}
                          className="flex flex-col items-center py-2.5 border-r border-white/[0.04] last:border-r-0"
                        >
                          <span className={cn('text-sm font-bold leading-none', s.color)}>{s.value}</span>
                          <span className="text-[8px] text-gray-600 uppercase tracking-wide mt-1">{s.label}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-8 text-center px-4">
                    <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center mb-2">
                      <CalendarCheck className="w-5 h-5 text-gray-700" />
                    </div>
                    <p className="text-sm text-gray-500">Belum ada data</p>
                    <p className="text-[11px] text-gray-700 mt-0.5">{periodLabel}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center">
          <Users className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">Tidak ada karyawan yang cocok</p>
        </div>
      )}
    </div>
  );
}
