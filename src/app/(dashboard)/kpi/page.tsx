'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save, Loader2, Target, CheckCircle2, AlertCircle, Calendar, CalendarDays, Info, CalendarCheck } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';

import { useToast } from '@/components/Toast';
import { cn, calculateAchievement, calculateWeightedScore, getGrade, getGradeColor, getGradeBg, formatPercent, getMonthName, getCurrentPeriod } from '@/lib/utils';
import { calculateAttendanceScore, calculateFinalScore, getAttendanceRates, type AttendanceEntry } from '@/lib/attendance';

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

interface Template {
  id: string;
  category: string;
  kpi_name: string;
  weight: number;
  target: number;
  unit: string;
  formula_type: 'higher_better' | 'lower_better';
  sort_order: number;
}

interface Entry {
  id: string;
  template_id: string;
  actual_value: number;
  notes: string | null;
  weeks_filled?: number;
}

export default function KpiPage() {
  const { toast } = useToast();
  const currentPeriod = getCurrentPeriod();
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('monthly');
  const [year, setYear] = useState(currentPeriod.year);
  const [month, setMonth] = useState(currentPeriod.month);
  const [week, setWeek] = useState(currentPeriod.week);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [entries, setEntries] = useState<Record<string, { actual_value: string; notes: string }>>({});
  const [weeksFilled, setWeeksFilled] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [divisionName, setDivisionName] = useState('');
  const [isAggregated, setIsAggregated] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceEntry | null>(null);

  const fetchKpi = useCallback(async () => {
    setLoading(true);
    setSaved(false);
    try {
      const params = new URLSearchParams({
        period_type: viewMode,
        year: year.toString(),
        month: month.toString(),
      });
      if (viewMode === 'weekly') params.set('week', week.toString());

      const res = await fetch(`/api/kpi?${params}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Gagal memuat data');
        setTemplates([]);
        return;
      }

      setError('');
      setTemplates(json.templates);
      setUserName(json.user?.full_name || '');
      setDivisionName((json.user?.divisions as { name: string } | null)?.name || '');
      setIsAggregated(json.is_aggregated || false);

      const entryMap: Record<string, { actual_value: string; notes: string }> = {};
      const weeksMap: Record<string, number> = {};
      (json.entries || []).forEach((e: Entry) => {
        entryMap[e.template_id] = { actual_value: String(Number(e.actual_value)), notes: e.notes || '' };
        if (e.weeks_filled !== undefined) {
          weeksMap[e.template_id] = e.weeks_filled;
        }
      });
      setEntries(entryMap);
      setWeeksFilled(weeksMap);
      setAttendance(json.attendance ?? null);
    } catch {
      setError('Gagal memuat data KPI');
    } finally {
      setLoading(false);
    }
  }, [viewMode, year, month, week]);

  useEffect(() => {
    fetchKpi();
  }, [fetchKpi]);

  const handleSave = async () => {
    if (isAggregated) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const entryData = templates.map((t) => ({
        template_id: t.id,
        actual_value: parseFloat(entries[t.id]?.actual_value) || 0,
        notes: entries[t.id]?.notes || '',
      }));

      const res = await fetch('/api/kpi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: entryData,
          period_type: 'weekly',
          year,
          month,
          week,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || 'Gagal menyimpan');
        toast('Gagal menyimpan data KPI', 'error');
        return;
      }

      setSaved(true);
      toast('Data KPI berhasil disimpan!', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const updateEntry = (templateId: string, field: 'actual_value' | 'notes', value: string) => {
    setEntries((prev) => ({
      ...prev,
      [templateId]: {
        ...prev[templateId],
        actual_value: prev[templateId]?.actual_value ?? '',
        notes: prev[templateId]?.notes || '',
        [field]: value,
      },
    }));
  };

  // Calculate scores
  const scores = templates.map((t) => {
    const actual = parseFloat(entries[t.id]?.actual_value) || 0;
    const achievement = calculateAchievement(actual, t.target, t.formula_type);
    const weighted = calculateWeightedScore(achievement, t.weight);
    return { ...t, actual, achievement, weighted };
  });

  const kpiTotal = scores.reduce((sum, s) => sum + s.weighted, 0);
  const attendanceScore = viewMode === 'monthly' ? calculateAttendanceScore(attendance) : 0;
  const finalTotal = viewMode === 'monthly' ? calculateFinalScore(kpiTotal, attendanceScore) : kpiTotal;
  const grade = getGrade(finalTotal, viewMode === 'monthly' ? 120 : 100);
  const roundedTotal = Math.round(finalTotal * 100) / 100;
  const { attendanceRate, tepatWaktuRate } = getAttendanceRates(viewMode === 'monthly' ? attendance : null);
  const kehadiranScore = Math.min(attendanceRate / 95, 1) * 15;
  const tepatWaktuScore = Math.min(tepatWaktuRate / 90, 1) * 5;

  const handlePeriodChange = (values: { periodType?: string; year?: number; month?: number; week?: number }) => {
    if (values.year) setYear(values.year);
    if (values.month) setMonth(values.month);
    if (values.week) setWeek(values.week);
  };

  const periodLabel = viewMode === 'monthly'
    ? `${getMonthName(month)} ${year}`
    : `Minggu ${week}, ${getMonthName(month)} ${year}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat KPI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 sm:w-7 sm:h-7 text-brand-300 flex-shrink-0" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">KPI Saya</h1>
              <p className="text-gray-500 text-xs sm:text-sm">
                {userName} &middot; {divisionName} &middot; {periodLabel}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
          {/* View Mode Tabs */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
            <button
              onClick={() => setViewMode('weekly')}
              className={cn(
                'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all',
                viewMode === 'weekly'
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Mingguan
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={cn(
                'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all',
                viewMode === 'monthly'
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <CalendarDays className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Bulanan
            </button>
          </div>

          {/* Period Selectors */}
          <PeriodSelector
            periodType={viewMode}
            year={year}
            month={month}
            week={week}
            onChange={handlePeriodChange}
            hideToggle={true}
          />
        </div>
      </div>

      {/* Aggregated notice */}
      {isAggregated && (
        <div className="bg-brand-500/[0.07] border border-brand-500/20 rounded-xl px-4 py-3 text-brand-300 text-sm flex items-center gap-2.5">
          <Info className="w-4 h-4 flex-shrink-0" />
          Data ini dihitung otomatis dari input mingguan Anda. Untuk mengubah data, silakan edit di tab Mingguan.
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {templates.length === 0 && !error ? (
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-12 text-center">
          <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Tidak ada template KPI untuk divisi Anda</p>
        </div>
      ) : (
        <>
          {/* Score Summary */}
          <div className={cn('grid grid-cols-1 gap-6', viewMode === 'monthly' && 'lg:grid-cols-3')}>
            <div className={viewMode === 'monthly' ? 'lg:col-span-2' : ''}>
              <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-400">
                    {isAggregated ? 'Ringkasan Bulanan' : 'Ringkasan Skor'}
                  </h3>
                  <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold', getGradeBg(grade), getGradeColor(grade))}>
                    Grade {grade} &middot; {roundedTotal}
                  </div>
                </div>

                {/* Score bars */}
                <div className="space-y-3">
                  {scores.map((s) => (
                    <div key={s.id} className="flex items-center gap-3">
                      <div className="w-24 sm:w-40 lg:w-56 text-xs text-gray-400 truncate">{s.kpi_name}</div>
                      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${s.achievement * 100}%`,
                            backgroundColor: CATEGORY_COLORS[s.category] || '#6b7280',
                          }}
                        />
                      </div>
                      <div className="w-14 text-right text-xs font-mono text-gray-300">{s.weighted.toFixed(1)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {viewMode === 'monthly' && (
              <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarCheck className="w-4 h-4 text-green-400" />
                  <h3 className="text-sm font-semibold text-gray-400">Absensi</h3>
                  {!attendance && (
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Belum Diisi
                    </span>
                  )}
                </div>
                {attendance ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          label: 'Kehadiran',
                          target: '≥ 95%',
                          displayValue: `${attendanceRate.toFixed(1)}%`,
                          perf: Math.min(attendanceRate / 95, 1) * 100,
                          color: attendanceRate >= 95 ? '#22c55e' : attendanceRate >= 80 ? '#f59e0b' : '#ef4444',
                          pts: `${kehadiranScore.toFixed(1)}/15`,
                        },
                        {
                          label: 'Tepat Waktu',
                          target: '≥ 90%',
                          displayValue: `${tepatWaktuRate.toFixed(1)}%`,
                          perf: Math.min(tepatWaktuRate / 90, 1) * 100,
                          color: tepatWaktuRate >= 90 ? '#22c55e' : tepatWaktuRate >= 75 ? '#f59e0b' : '#ef4444',
                          pts: `${tepatWaktuScore.toFixed(1)}/5`,
                        },
                      ].map((item) => (
                        <div key={item.label} className="flex flex-col items-center gap-2">
                          <div className="relative" style={{ width: 90, height: 90 }}>
                            <svg viewBox="0 0 36 36" style={{ width: 90, height: 90, transform: 'rotate(-90deg)' }}>
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                              <circle
                                cx="18" cy="18" r="15.9"
                                fill="none"
                                stroke={item.color}
                                strokeWidth="3"
                                strokeDasharray={`${item.perf.toFixed(2)} ${(100 - item.perf).toFixed(2)}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-sm font-bold text-white">{item.displayValue}</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-300">{item.label}</p>
                            <p className="text-[10px] text-gray-500">Target {item.target}</p>
                            <p className="text-xs font-bold mt-0.5" style={{ color: item.color }}>{item.pts} pts</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-xs text-gray-500">Total Absensi</span>
                      <div>
                        <span className="text-sm font-bold text-green-400">{attendanceScore.toFixed(1)}</span>
                        <span className="text-xs text-gray-500">/20 pts</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-500">Data absensi belum diisi oleh admin</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* KPI Entry Table */}
          <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-400">
                  {isAggregated ? 'Data KPI Bulanan (Otomatis)' : 'Input Data KPI'}
                </h3>
                {isAggregated && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    {scores[0]?.formula_type === 'higher_better' ? 'Higher is better: SUM mingguan' : 'Agregasi'} &middot; Lower is better: RATA-RATA mingguan
                  </p>
                )}
              </div>
              {!isAggregated && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    saved
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-400/25'
                  )}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : saved ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Tersimpan!
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Simpan
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kategori</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">KPI</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bobot</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Target</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Aktual</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Capaian</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Skor</th>
                    {isAggregated ? (
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Minggu</th>
                    ) : (
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Catatan</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s, i) => (
                    <tr key={s.id} className={cn('border-b border-white/[0.03]', i % 2 === 0 ? 'bg-white/[0.01]' : '')}>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[s.category] || '#6b7280' }} />
                          {s.category}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-white font-medium">{s.kpi_name}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{s.weight}%</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{s.target}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{s.unit}</td>
                      <td className="px-4 py-3">
                        {isAggregated ? (
                          <div className="text-center text-sm font-medium text-white">
                            {s.actual.toFixed(s.formula_type === 'lower_better' ? 2 : 0)}
                          </div>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            value={entries[s.id]?.actual_value ?? ''}
                            onChange={(e) => updateEntry(s.id, 'actual_value', e.target.value)}
                            className="w-24 mx-auto block px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-center text-sm text-white focus:outline-none focus:border-brand-400/50 transition-colors"
                            placeholder="0"
                          />
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-sm font-medium', s.achievement >= 1 ? 'text-emerald-400' : s.achievement >= 0.7 ? 'text-amber-400' : 'text-red-400')}>
                          {formatPercent(s.achievement)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-bold text-white">{s.weighted.toFixed(1)}</td>
                      {isAggregated ? (
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            'text-xs font-medium px-2 py-1 rounded-lg',
                            (weeksFilled[s.id] || 0) >= 4 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          )}>
                            {weeksFilled[s.id] || 0}/5
                          </span>
                        </td>
                      ) : (
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={entries[s.id]?.notes ?? ''}
                            onChange={(e) => updateEntry(s.id, 'notes', e.target.value)}
                            className="w-full px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-brand-400/50 transition-colors"
                            placeholder="..."
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.02]">
                    <td colSpan={7} className="px-6 py-4 text-right">
                      {viewMode === 'monthly' ? (
                        <div>
                          <span className="text-sm font-semibold text-gray-400">Final Skor</span>
                          <span className="ml-2 text-xs text-gray-600">
                            (KPI {kpiTotal.toFixed(1)} + Absensi {attendanceScore.toFixed(1)}) / 120
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-gray-400">Total Skor</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={cn('text-lg font-bold', getGradeColor(grade))}>{roundedTotal}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn('inline-flex px-3 py-1 rounded-lg border text-sm font-bold', getGradeBg(grade), getGradeColor(grade))}>
                        {grade}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden p-4 space-y-3">
              {scores.map((s) => (
                <div key={s.id} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[s.category] || '#6b7280' }} />
                      {s.category}
                    </span>
                    <span className="text-xs text-gray-500">Bobot: {s.weight}%</span>
                  </div>
                  <p className="text-sm font-medium text-white">{s.kpi_name}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>Target: {s.target} {s.unit}</span>
                    <span className={cn('font-medium', s.achievement >= 1 ? 'text-emerald-400' : s.achievement >= 0.7 ? 'text-amber-400' : 'text-red-400')}>
                      Capaian: {formatPercent(s.achievement)}
                    </span>
                    <span className="font-bold text-white">Skor: {s.weighted.toFixed(1)}</span>
                  </div>
                  {isAggregated ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Aktual: <span className="text-white font-medium">{s.actual.toFixed(s.formula_type === 'lower_better' ? 2 : 0)}</span></span>
                      <span className={cn(
                        'text-xs font-medium px-2 py-1 rounded-lg',
                        (weeksFilled[s.id] || 0) >= 4 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                      )}>
                        Minggu: {weeksFilled[s.id] || 0}/5
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="number"
                        step="any"
                        value={entries[s.id]?.actual_value ?? ''}
                        onChange={(e) => updateEntry(s.id, 'actual_value', e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-brand-400/50 transition-colors"
                        placeholder="Aktual"
                      />
                      <input
                        type="text"
                        value={entries[s.id]?.notes ?? ''}
                        onChange={(e) => updateEntry(s.id, 'notes', e.target.value)}
                        className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-brand-400/50 transition-colors"
                        placeholder="Catatan..."
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Total footer card */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-gray-400">{viewMode === 'monthly' ? 'Final Skor' : 'Total Skor'}</span>
                  {viewMode === 'monthly' && (
                    <p className="text-xs text-gray-600 mt-0.5">KPI {kpiTotal.toFixed(1)} + Absensi {attendanceScore.toFixed(1)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-lg font-bold', getGradeColor(grade))}>{roundedTotal}</span>
                  <span className={cn('px-2.5 py-1 rounded-lg border text-sm font-bold', getGradeBg(grade), getGradeColor(grade))}>
                    {grade}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Attendance Section - Monthly only */}
          {viewMode === 'monthly' && (
            <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-green-400" />
                  <h3 className="text-sm font-semibold text-gray-400">Absensi Bulan Ini</h3>
                </div>
                {!attendance && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Belum Diisi
                  </span>
                )}
              </div>

              {attendance ? (
                <div className="p-5 space-y-4">
                  {/* Stats row */}
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {[
                      { label: 'Hari Kerja', value: attendance.hari_kerja },
                      { label: 'Hadir', value: attendance.hadir },
                      { label: 'Terlambat', value: attendance.terlambat },
                      { label: 'Sakit', value: attendance.sakit },
                      { label: 'Cuti', value: attendance.cuti },
                    ].map((item) => (
                      <div key={item.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                        <div className="text-xl font-bold text-white">{item.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Total absensi score + formula */}
                  <div className="bg-green-500/[0.06] border border-green-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-white">Total Absensi Score</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        KPI {kpiTotal.toFixed(1)} + Absensi {attendanceScore.toFixed(1)} = Final {roundedTotal} / 120
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-green-400">{attendanceScore.toFixed(1)}</span>
                      <span className="text-sm font-normal text-gray-500">/20 pts</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <CalendarCheck className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Data absensi bulan ini belum diisi oleh admin.</p>
                  <p className="text-xs text-gray-600 mt-1">Hubungi admin untuk mengisi data absensi Anda.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
