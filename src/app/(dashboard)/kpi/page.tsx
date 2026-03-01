'use client';

import { useEffect, useState, useCallback } from 'react';
import { Save, Loader2, Target, CheckCircle2, AlertCircle, Calendar, CalendarDays, Info } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';
import KpiPieChart from '@/components/KpiPieChart';
import { useToast } from '@/components/Toast';
import { cn, calculateAchievement, calculateWeightedScore, getGrade, getGradeColor, getGradeBg, formatPercent, getMonthName, getCurrentPeriod } from '@/lib/utils';

const CATEGORY_COLORS: Record<string, string> = {
  Productivity: '#2A62FF',
  Efficiency: '#3b82f6',
  Quality: '#10b981',
  'Creative Development': '#f59e0b',
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
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly');
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

  const totalScore = scores.reduce((sum, s) => sum + s.weighted, 0);
  const grade = getGrade(totalScore);
  const roundedTotal = Math.round(totalScore * 100) / 100;

  // Pie chart data
  const categoryData = Object.entries(
    scores.reduce((acc, s) => {
      acc[s.category] = (acc[s.category] || 0) + s.weighted;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({
    name,
    value: Math.round(value * 100) / 100,
    color: CATEGORY_COLORS[name] || '#6b7280',
  }));

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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Target className="w-7 h-7 text-brand-300" />
            KPI Saya
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {userName} &middot; {divisionName} &middot; {periodLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Tabs */}
          <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-xl p-1">
            <button
              onClick={() => setViewMode('weekly')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all',
                viewMode === 'weekly'
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              Mingguan
            </button>
            <button
              onClick={() => setViewMode('monthly')}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all',
                viewMode === 'monthly'
                  ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                  : 'text-gray-400 hover:text-white'
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
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
                      <div className="w-40 lg:w-56 text-xs text-gray-400 truncate">{s.kpi_name}</div>
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

            {categoryData.length > 0 && (
              <KpiPieChart
                data={categoryData}
                title="Skor per Kategori"
                centerLabel="Total"
                centerValue={roundedTotal.toString()}
              />
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

            <div className="overflow-x-auto">
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
                    <td colSpan={7} className="px-6 py-4 text-right text-sm font-semibold text-gray-400">Total Skor</td>
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
          </div>
        </>
      )}
    </div>
  );
}
