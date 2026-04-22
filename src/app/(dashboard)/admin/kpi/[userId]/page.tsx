'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Save, Loader2, Target, CheckCircle2, AlertCircle, Calendar, CalendarDays, Info, ArrowLeft, CalendarCheck, ExternalLink, RefreshCw, X, CheckCircle, XCircle, Calculator, Pencil } from 'lucide-react';
import PeriodSelector from '@/components/PeriodSelector';

import { useToast } from '@/components/Toast';
import VideoPointCalculator, { isVideoOutputTemplate } from '@/components/VideoPointCalculator';
import { cn, calculateAchievement, calculateWeightedScore, getGrade, getGradeColor, getGradeBg, formatPercent, getMonthName, getCurrentPeriod, getWeeksInMonth, getEffectiveTarget } from '@/lib/utils';
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
  denominator_template_id: string | null;
}

interface Entry {
  id: string;
  template_id: string;
  actual_value: number;
  notes: string | null;
  weeks_filled?: number;
}

export default function AdminKpiEditPage() {
  const { userId } = useParams<{ userId: string }>();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const currentPeriod = getCurrentPeriod();

  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('monthly');
  const [year, setYear] = useState(parseInt(searchParams.get('year') || currentPeriod.year.toString()));
  const [month, setMonth] = useState(parseInt(searchParams.get('month') || currentPeriod.month.toString()));
  const [week, setWeek] = useState(parseInt(searchParams.get('week') || currentPeriod.week.toString()));
  const [templates, setTemplates] = useState<Template[]>([]);
  const [entries, setEntries] = useState<Record<string, { actual_value: string; notes: string }>>({});
  const [weeksFilled, setWeeksFilled] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [divisionName, setDivisionName] = useState('');
  const [divisionId, setDivisionId] = useState('');
  const [isAggregated, setIsAggregated] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceEntry | null>(null);
  const [trelloOtd, setTrelloOtd] = useState<{ otdPercentage: number; onTime: number; late: number; total: number } | null>(null);
  const [trelloRefreshing, setTrelloRefreshing] = useState(false);
  const [trelloDetails, setTrelloDetails] = useState<{ card_id: string; name: string; list: string; board: string; due: string; completed: string; is_on_time: boolean; excluded: boolean; members: string[]; admin_note: string | null; due_overridden: boolean; completed_at_overridden: boolean; is_on_time_overridden: boolean; original_due: string | null; due_changed: boolean }[]>([]);
  const [showTrelloDetail, setShowTrelloDetail] = useState(false);
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ due: string; completed_at: string; is_on_time: 'auto' | 'yes' | 'no'; excluded: boolean; admin_note: string }>({ due: '', completed_at: '', is_on_time: 'auto', excluded: false, admin_note: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [showVideoCalc, setShowVideoCalc] = useState(false);
  const [videoCalcTemplateId, setVideoCalcTemplateId] = useState('');

  const isOtdTemplate = (t: { kpi_name: string }) => {
    const name = t.kpi_name.toLowerCase();
    return name.includes('on-time delivery') || name.includes('on time delivery') || name.includes('otd');
  };

  const backUrl = divisionId ? `/admin/divisi/${divisionId}` : '/admin/divisi';

  const fetchKpi = useCallback(async () => {
    setLoading(true);
    setSaved(false);
    setTrelloDetails([]);
    try {
      const params = new URLSearchParams({
        user_id: userId,
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
      setDivisionId(json.user?.division_id || '');
      setIsAggregated(json.is_aggregated || false);

      const entryMap: Record<string, { actual_value: string; notes: string }> = {};
      const weeksMap: Record<string, number> = {};
      (json.entries || []).forEach((e: Entry) => {
        entryMap[e.template_id] = { actual_value: String(Number(e.actual_value)), notes: e.notes || '' };
        if (e.weeks_filled !== undefined) {
          weeksMap[e.template_id] = e.weeks_filled;
        }
      });
      // Auto-fill OTD from Trello
      const trelloData = json.trello_otd ?? null;
      setTrelloOtd(trelloData);
      const divId = json.user?.division_id || '';
      const fullName = json.user?.full_name || '';
      if (trelloData && divId) {
        // Eagerly load card details for per-user filtering
        try {
          const detailParams = new URLSearchParams({ division_id: divId, year: year.toString(), month: month.toString() });
          if (viewMode === 'weekly') detailParams.append('week', week.toString());
          const detailRes = await fetch(`/api/trello/otd?${detailParams}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            const details = detailData.details || [];
            setTrelloDetails(details);
            // Filter by user name and compute per-user OTD
            const nameLower = fullName.toLowerCase();
            const otdTpl = (json.templates || []).find((t: Template) => isOtdTemplate(t));
            if (otdTpl && nameLower) {
              const userCards = details.filter((card: { members: string[] }) =>
                card.members.some((m: string) => {
                  const ml = m.toLowerCase();
                  return ml.includes(nameLower) || nameLower.includes(ml);
                })
              );
              const onTime = userCards.filter((c: { is_on_time: boolean }) => c.is_on_time).length;
              const total = userCards.length;
              const pct = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;
              entryMap[otdTpl.id] = { actual_value: String(pct), notes: entryMap[otdTpl.id]?.notes || '' };
            }
          }
        } catch { /* ignore */ }
      }

      setEntries(entryMap);
      setWeeksFilled(weeksMap);
      setAttendance(json.attendance ?? null);
    } catch {
      setError('Gagal memuat data KPI');
    } finally {
      setLoading(false);
    }
  }, [userId, viewMode, year, month, week]);

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
          user_id: userId,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || 'Gagal menyimpan');
        toast('Gagal menyimpan data KPI', 'error');
        return;
      }

      setSaved(true);
      toast(`Data KPI ${userName} berhasil disimpan!`, 'success');
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

  const weeksInMonth = getWeeksInMonth();
  const isRate = (t: Template) => !!t.denominator_template_id;

  // Compute raw actuals from entries
  const rawActuals: Record<string, number> = {};
  for (const t of templates) {
    rawActuals[t.id] = parseFloat(entries[t.id]?.actual_value) || 0;
  }
  // Compute rate display values (raw / denominator as plain ratio)
  const rateDisplayValues: Record<string, number> = {};
  for (const t of templates) {
    if (isRate(t)) {
      const num = rawActuals[t.id];
      const den = rawActuals[t.denominator_template_id!] ?? 0;
      rateDisplayValues[t.id] = den === 0 ? 0 : Math.round((num / den) * 100) / 100;
    }
  }

  const scores = templates.map((t) => {
    const actual = isRate(t) ? rateDisplayValues[t.id] : rawActuals[t.id];
    const rawInput = rawActuals[t.id];
    const effectiveTarget = getEffectiveTarget(t.target, t.formula_type, viewMode, weeksInMonth, isRate(t), isOtdTemplate(t));
    const achievement = calculateAchievement(actual, effectiveTarget, t.formula_type);
    const weighted = calculateWeightedScore(achievement, t.weight);
    const denominator = isRate(t) ? (rawActuals[t.denominator_template_id!] ?? 0) : 0;
    return { ...t, actual, rawInput, denominator, achievement, weighted, effectiveTarget };
  });

  const kpiTotal = scores.reduce((sum, s) => sum + s.weighted, 0);
  const attendanceScore = viewMode === 'monthly' ? calculateAttendanceScore(attendance) : 0;
  const finalTotal = viewMode === 'monthly' ? calculateFinalScore(kpiTotal, attendanceScore) : kpiTotal;
  const grade = getGrade(finalTotal, 100);
  const roundedTotal = Math.round(finalTotal * 100) / 100;
  const { lateMinutes, tidakHadir, withinBuffer } = getAttendanceRates(viewMode === 'monthly' ? attendance : null);

  const handlePeriodChange = (values: { periodType?: string; year?: number; month?: number; week?: number }) => {
    if (values.year) setYear(values.year);
    if (values.month) setMonth(values.month);
    if (values.week) setWeek(values.week);
  };

  const readTrelloFromDb = async () => {
    if (!divisionId) return;
    const otdQuery = new URLSearchParams({ division_id: divisionId, year: year.toString(), month: month.toString() });
    if (viewMode === 'weekly') otdQuery.append('week', week.toString());
    const res = await fetch(`/api/trello/otd?${otdQuery}`);
    if (!res.ok) throw new Error('gagal baca snapshot');
    const json = await res.json();
    const newOtd = { otdPercentage: json.otd_percentage, onTime: json.on_time, late: json.late, total: json.total };
    setTrelloOtd(newOtd);
    const details = json.details || [];
    setTrelloDetails(details);
    // Recompute per-user OTD dari details (exclude card yang excluded)
    const otdTpl = templates.find((t) => isOtdTemplate(t));
    if (otdTpl && userName) {
      const nameLower = userName.toLowerCase();
      const userCards = details.filter((card: { members: string[]; excluded: boolean }) =>
        !card.excluded &&
        card.members.some((m: string) => {
          const ml = m.toLowerCase();
          return ml.includes(nameLower) || nameLower.includes(ml);
        })
      );
      const onTime = userCards.filter((c: { is_on_time: boolean }) => c.is_on_time).length;
      const total = userCards.length;
      const pct = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;
      setEntries((prev) => ({
        ...prev,
        [otdTpl.id]: { actual_value: String(pct), notes: prev[otdTpl.id]?.notes || '' },
      }));
    }
  };

  const refreshTrelloOtd = async () => {
    if (!divisionId) return;
    setTrelloRefreshing(true);
    try {
      // Step 1: sync dari Trello ke DB (preserve override admin)
      const syncRes = await fetch('/api/admin/trello/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ division_id: divisionId }),
      });
      if (!syncRes.ok) {
        const json = await syncRes.json().catch(() => ({}));
        toast(json.error || 'Gagal sync dari Trello', 'error');
      }
      // Step 2: baca DB snapshot (selalu lakukan walau sync gagal)
      await readTrelloFromDb();
      if (syncRes.ok) toast('Data Trello OTD berhasil diperbarui', 'success');
    } catch {
      toast('Gagal mengambil data Trello', 'error');
    } finally {
      setTrelloRefreshing(false);
    }
  };

  const openTrelloDetail = async () => {
    if (!divisionId) return;
    setShowTrelloDetail(true);
    if (trelloDetails.length === 0) {
      try {
        const params = new URLSearchParams({ division_id: divisionId, year: year.toString(), month: month.toString() });
        if (viewMode === 'weekly') params.append('week', week.toString());
        const res = await fetch(`/api/trello/otd?${params}`);
        if (res.ok) {
          const data = await res.json();
          setTrelloDetails(data.details || []);
        }
      } catch { /* ignore */ }
    }
  };

  const userTrelloDetails = useMemo(() => {
    if (!userName || trelloDetails.length === 0) return trelloDetails;
    const nameLower = userName.toLowerCase();
    return trelloDetails.filter(card =>
      card.members.some(m => {
        const ml = m.toLowerCase();
        return ml.includes(nameLower) || nameLower.includes(ml);
      })
    );
  }, [trelloDetails, userName]);

  const openCardEdit = (card: typeof trelloDetails[number]) => {
    setEditCardId(card.card_id);
    const toLocalDt = (iso: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEditForm({
      due: toLocalDt(card.due),
      completed_at: toLocalDt(card.completed),
      is_on_time: card.is_on_time_overridden ? (card.is_on_time ? 'yes' : 'no') : 'auto',
      excluded: card.excluded,
      admin_note: card.admin_note || '',
    });
  };

  const saveCardEdit = async () => {
    if (!editCardId) return;
    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = {
        due: editForm.due ? new Date(editForm.due).toISOString() : null,
        completed_at: editForm.completed_at ? new Date(editForm.completed_at).toISOString() : null,
        excluded: editForm.excluded,
        admin_note: editForm.admin_note || null,
      };
      if (editForm.is_on_time === 'auto') {
        body.reset = ['is_on_time'];
      } else {
        body.is_on_time = editForm.is_on_time === 'yes';
      }
      const res = await fetch(`/api/admin/trello/cards/${editCardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast(json.error || 'Gagal menyimpan override', 'error');
        return;
      }
      toast('Override berhasil disimpan', 'success');
      setEditCardId(null);
      await readTrelloFromDb();
    } catch {
      toast('Gagal menyimpan override', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const resetCardOverride = async (cardId: string) => {
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/trello/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: ['due', 'completed_at', 'is_on_time'], excluded: false, admin_note: null }),
      });
      if (!res.ok) {
        toast('Gagal reset override', 'error');
        return;
      }
      toast('Override direset. Sync ulang untuk ambil data Trello terbaru.', 'success');
      setEditCardId(null);
      await readTrelloFromDb();
    } catch {
      toast('Gagal reset override', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const userTrelloOtd = useMemo(() => {
    if (!trelloOtd || !userName || trelloDetails.length === 0) return trelloOtd;
    const included = userTrelloDetails.filter(c => !c.excluded);
    const onTime = included.filter(c => c.is_on_time).length;
    const total = included.length;
    return {
      ...trelloOtd,
      total,
      onTime,
      late: total - onTime,
      otdPercentage: total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0,
    };
  }, [trelloOtd, userTrelloDetails, userName, trelloDetails]);

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
          <div>
            <Link href={backUrl} className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-gray-500 hover:text-white transition-colors mb-2">
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Kembali
            </Link>
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 sm:w-7 sm:h-7 text-brand-300 flex-shrink-0" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">Edit KPI</h1>
                <p className="text-gray-500 text-xs sm:text-sm">
                  {userName} &middot; {divisionName} &middot; {periodLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
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

      {/* Admin notice */}
      <div className="bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-4 py-3 text-amber-300 text-sm flex items-center gap-2.5">
        <Info className="w-4 h-4 flex-shrink-0" />
        Anda sedang mengedit KPI milik <strong>{userName}</strong>
      </div>

      {isAggregated && (
        <div className="bg-brand-500/[0.07] border border-brand-500/20 rounded-xl px-4 py-3 text-brand-300 text-sm flex items-center gap-2.5">
          <Info className="w-4 h-4 flex-shrink-0" />
          Data ini dihitung otomatis dari input mingguan. Untuk mengubah data, gunakan tab Mingguan.
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
          <p className="text-gray-400">Tidak ada template KPI untuk divisi karyawan ini</p>
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
                    {(() => {
                      const perf = lateMinutes === 0 ? 100 : withinBuffer ? 100 : Math.min((60 / lateMinutes) * 100, 100);
                      const color = withinBuffer ? '#22c55e' : lateMinutes <= 120 ? '#f59e0b' : '#ef4444';
                      return (
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative" style={{ width: 110, height: 110 }}>
                            <svg viewBox="0 0 36 36" style={{ width: 110, height: 110, transform: 'rotate(-90deg)' }}>
                              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                              <circle
                                cx="18" cy="18" r="15.9"
                                fill="none"
                                stroke={color}
                                strokeWidth="3"
                                strokeDasharray={`${perf.toFixed(2)} ${(100 - perf).toFixed(2)}`}
                                strokeLinecap="round"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-lg font-bold text-white leading-none">{lateMinutes}</span>
                              <span className="text-[10px] text-gray-400 mt-0.5">menit</span>
                            </div>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-300">Keterlambatan</p>
                            <p className="text-[10px] text-gray-500">Toleransi ≤ 60 menit/bln</p>
                            <p className="text-xs font-bold mt-0.5" style={{ color }}>{attendanceScore.toFixed(1)}/5 pts</p>
                          </div>
                        </div>
                      );
                    })()}
                    <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-xs text-gray-500">Tidak Hadir</span>
                      <span className="text-xs text-gray-300">{tidakHadir} hari</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">Total Absensi</span>
                      <div>
                        <span className="text-sm font-bold text-green-400">{attendanceScore.toFixed(1)}</span>
                        <span className="text-xs text-gray-500">/5 pts</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-gray-500">Data absensi belum diisi</p>
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
                    Higher is better: SUM mingguan &middot; Lower is better: RATA-RATA mingguan
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
                      <td className="px-4 py-3 text-center text-sm text-gray-400">{s.effectiveTarget}</td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">{s.unit}</td>
                      <td className="px-4 py-3">
                        {isAggregated ? (
                          <div className="text-center text-sm font-medium text-white">
                            {isRate(s) ? (
                              <div>
                                <span>{s.rawInput.toFixed(0)}</span>
                                <span className="text-sm text-gray-500 ml-1">÷ {s.denominator.toFixed(0)}</span>
                                <span className="text-sm text-brand-400 ml-1">= {s.actual.toFixed(2)}</span>
                              </div>
                            ) : isOtdTemplate(s) && userTrelloOtd ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span>{s.actual.toFixed(1)}%</span>
                                <div className="flex items-center gap-1.5">
                                  <button type="button" onClick={openTrelloDetail} className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                                    Trello: {userTrelloOtd.onTime}/{userTrelloOtd.total} on-time <ExternalLink className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={refreshTrelloOtd} disabled={trelloRefreshing} className="text-blue-400 hover:text-blue-300 transition-colors">
                                    <RefreshCw className={cn('w-3 h-3', trelloRefreshing && 'animate-spin')} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              s.actual.toFixed(s.formula_type === 'lower_better' ? 2 : 0)
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5">
                            {isOtdTemplate(s) && userTrelloOtd ? (
                              <>
                                <div className="w-24 mx-auto px-3 py-1.5 bg-blue-500/[0.08] border border-blue-500/20 rounded-lg text-center text-sm text-white font-medium">
                                  {userTrelloOtd.otdPercentage}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <button type="button" onClick={openTrelloDetail} className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                                    Trello: {userTrelloOtd.onTime}/{userTrelloOtd.total} on-time <ExternalLink className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={refreshTrelloOtd} disabled={trelloRefreshing} className="text-blue-400 hover:text-blue-300 transition-colors">
                                    <RefreshCw className={cn('w-3 h-3', trelloRefreshing && 'animate-spin')} />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  step="any"
                                  value={entries[s.id]?.actual_value ?? ''}
                                  onChange={(e) => updateEntry(s.id, 'actual_value', e.target.value)}
                                  className="w-24 mx-auto block px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-center text-sm text-white focus:outline-none focus:border-brand-400/50 transition-colors"
                                  placeholder="0"
                                />
                                {isVideoOutputTemplate(s) && (
                                  <button
                                    type="button"
                                    onClick={() => { setVideoCalcTemplateId(s.id); setShowVideoCalc(true); }}
                                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                                  >
                                    <Calculator className="w-3 h-3" /> Kalkulator Poin
                                  </button>
                                )}
                                {isRate(s) && s.rawInput > 0 && (
                                  <span className="text-sm text-brand-400">{s.rawInput.toFixed(0)} ÷ {s.denominator.toFixed(0)} = {s.actual.toFixed(2)}</span>
                                )}
                              </>
                            )}
                          </div>
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
                            (KPI {kpiTotal.toFixed(1)} × 0.95 + Absensi {attendanceScore.toFixed(1)}) / 100
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
          </div>

          {/* Attendance Section - Monthly only (read-only for admin, edit via /admin/absensi) */}
          {viewMode === 'monthly' && (
            <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-green-400" />
                  <h3 className="text-sm font-semibold text-gray-400">Absensi Bulan Ini</h3>
                </div>
                <div className="flex items-center gap-2">
                  {!attendance && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      Belum Diisi
                    </span>
                  )}
                  <Link
                    href={`/admin/absensi?year=${year}&month=${month}`}
                    className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Edit Absensi
                  </Link>
                </div>
              </div>

              {attendance ? (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Menit Terlambat', value: `${attendance.terlambat}` },
                      { label: 'Tidak Hadir', value: `${tidakHadir}` },
                      { label: 'Sakit', value: `${attendance.sakit}` },
                      { label: 'Cuti', value: `${attendance.cuti}` },
                    ].map((item) => (
                      <div key={item.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                        <div className="text-xl font-bold text-white">{item.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-green-500/[0.06] border border-green-500/20 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-white">Total Absensi Score</span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        KPI {kpiTotal.toFixed(1)} × 0.95 + Absensi {attendanceScore.toFixed(1)} = Final {roundedTotal} / 100
                      </p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {withinBuffer ? '✓ Keterlambatan masih dalam toleransi 60 menit' : `Keterlambatan ${lateMinutes} menit melebihi toleransi 60 menit`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-green-400">{attendanceScore.toFixed(1)}</span>
                      <span className="text-sm font-normal text-gray-500">/5 pts</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center">
                  <CalendarCheck className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Data absensi bulan ini belum diisi.</p>
                  <Link
                    href={`/admin/absensi?year=${year}&month=${month}`}
                    className="inline-flex items-center gap-1.5 mt-3 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Isi Absensi Sekarang
                  </Link>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Trello OTD Detail Modal */}
      {showTrelloDetail && userTrelloOtd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setShowTrelloDetail(false)}>
          <div
            className="bg-[#16161e] border border-white/[0.08] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white">Trello OTD Detail</h2>
                <p className="text-xs text-gray-500 mt-0.5">{userName} — {divisionName} — {getMonthName(month)} {year}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => { await refreshTrelloOtd(); setTrelloDetails([]); const params = new URLSearchParams({ division_id: divisionId, year: year.toString(), month: month.toString() }); if (viewMode === 'weekly') params.append('week', week.toString()); try { const res = await fetch(`/api/trello/otd?${params}`); if (res.ok) { const data = await res.json(); setTrelloDetails(data.details || []); } } catch {} }}
                  disabled={trelloRefreshing}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <RefreshCw className={cn('w-4 h-4', trelloRefreshing && 'animate-spin')} />
                </button>
                <button onClick={() => setShowTrelloDetail(false)} className="text-gray-500 hover:text-white transition-colors p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* KPI Summary */}
            <div className="grid grid-cols-4 gap-3 p-5 border-b border-white/[0.06] flex-shrink-0">
              <div className="bg-blue-500/[0.08] border border-blue-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Total Card</p>
                <p className="text-2xl font-bold text-blue-400 mt-1">{userTrelloOtd.total}</p>
              </div>
              <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">On Time</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{userTrelloOtd.onTime}</p>
              </div>
              <div className="bg-red-500/[0.08] border border-red-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wider">Terlambat</p>
                <p className="text-2xl font-bold text-red-400 mt-1">{userTrelloOtd.late}</p>
              </div>
              <div className={cn(
                "border rounded-xl p-3 text-center",
                userTrelloOtd.otdPercentage >= 80 ? "bg-emerald-500/[0.08] border-emerald-500/20" :
                userTrelloOtd.otdPercentage >= 60 ? "bg-amber-500/[0.08] border-amber-500/20" :
                "bg-red-500/[0.08] border-red-500/20"
              )}>
                <p className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  userTrelloOtd.otdPercentage >= 80 ? "text-emerald-400" : userTrelloOtd.otdPercentage >= 60 ? "text-amber-400" : "text-red-400"
                )}>% OTD</p>
                <p className={cn(
                  "text-2xl font-bold mt-1",
                  userTrelloOtd.otdPercentage >= 80 ? "text-emerald-400" : userTrelloOtd.otdPercentage >= 60 ? "text-amber-400" : "text-red-400"
                )}>{userTrelloOtd.otdPercentage}%</p>
              </div>
            </div>

            {/* Card Table */}
            <div className="overflow-auto flex-1">
              {trelloDetails.length === 0 ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-6 h-6 text-gray-500 animate-spin mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Memuat detail card...</p>
                </div>
              ) : userTrelloDetails.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-sm">Tidak ada card untuk {userName}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Card</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Board</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">List</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due Date</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tgl Selesai</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Selisih</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userTrelloDetails
                      .sort((a, b) => new Date(b.due).getTime() - new Date(a.due).getTime())
                      .map((card, i) => {
                        const due = card.due ? new Date(card.due) : null;
                        const act = card.completed ? new Date(card.completed) : null;
                        const diffDays = due && act ? Math.ceil((act.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : null;
                        const anyOverride = card.due_overridden || card.completed_at_overridden || card.is_on_time_overridden;
                        return (
                          <tr key={card.card_id || i} className={cn(
                            'border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors',
                            card.excluded && 'opacity-50',
                            anyOverride && !card.excluded && 'bg-amber-500/[0.03]'
                          )}>
                            <td className="px-4 py-3 text-white font-medium max-w-[200px] truncate">
                              {card.name}
                              {anyOverride && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-semibold" title="Ada override admin">OVR</span>}
                              {card.excluded && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-gray-500/15 text-gray-400 font-semibold">EXCLUDED</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs max-w-[150px]">
                              {card.members && card.members.length > 0 ? card.members.join(', ') : <span className="text-gray-600">-</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">{card.board}</td>
                            <td className="px-4 py-3 text-gray-500">{card.list}</td>
                            <td className="px-4 py-3 text-center">
                              <div className={cn('text-gray-400', card.due_overridden && 'text-amber-400')}>
                                {due ? due.toLocaleDateString('id-ID') : '—'}
                              </div>
                            </td>
                            <td className={cn('px-4 py-3 text-center', card.completed_at_overridden ? 'text-amber-400' : 'text-gray-400')}>
                              {act ? act.toLocaleDateString('id-ID') : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {diffDays !== null ? (
                                <span className={cn('font-semibold', card.is_on_time ? 'text-emerald-400' : 'text-red-400')}>
                                  {diffDays <= 1 ? `${diffDays}d` : `+${diffDays}d`}
                                </span>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn(
                                'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg',
                                card.excluded ? 'bg-gray-500/10 text-gray-400' :
                                card.is_on_time ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              )}>
                                {card.excluded ? '—' : card.is_on_time ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                {card.excluded ? 'EXCLUDED' : card.is_on_time ? 'ON TIME' : 'TERLAMBAT'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => openCardEdit(card)}
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-brand-500/20 text-gray-400 hover:text-brand-300 transition-colors"
                                title="Edit card override"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <VideoPointCalculator
        open={showVideoCalc}
        onClose={() => setShowVideoCalc(false)}
        initialBreakdown={entries[videoCalcTemplateId]?.notes || ''}
        onApply={(total, breakdown) => {
          if (videoCalcTemplateId) {
            setEntries((prev) => ({
              ...prev,
              [videoCalcTemplateId]: { actual_value: String(total), notes: breakdown },
            }));
          }
        }}
      />

      {/* Card Edit Modal (override) */}
      {editCardId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !savingEdit && setEditCardId(null)}>
          <div className="bg-[#16161e] border border-white/[0.08] rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Edit Override Card</h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[300px]">{trelloDetails.find(c => c.card_id === editCardId)?.name || ''}</p>
              </div>
              <button onClick={() => !savingEdit && setEditCardId(null)} className="text-gray-500 hover:text-white transition-colors p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Due Date</label>
                <input
                  type="datetime-local"
                  value={editForm.due}
                  onChange={(e) => setEditForm((f) => ({ ...f, due: e.target.value }))}
                  className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Tanggal Selesai (Completed)</label>
                <input
                  type="datetime-local"
                  value={editForm.completed_at}
                  onChange={(e) => setEditForm((f) => ({ ...f, completed_at: e.target.value }))}
                  className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Status On-Time</label>
                <select
                  value={editForm.is_on_time}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_on_time: e.target.value as 'auto' | 'yes' | 'no' }))}
                  className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="auto">Auto (hitung dari due + completed)</option>
                  <option value="yes">On Time (paksa ya)</option>
                  <option value="no">Terlambat (paksa tidak)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editForm.excluded}
                  onChange={(e) => setEditForm((f) => ({ ...f, excluded: e.target.checked }))}
                  className="w-4 h-4 accent-brand-500"
                />
                <span className="text-sm text-gray-300">Exclude dari perhitungan OTD</span>
              </label>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Catatan Admin (opsional)</label>
                <textarea
                  value={editForm.admin_note}
                  onChange={(e) => setEditForm((f) => ({ ...f, admin_note: e.target.value }))}
                  rows={2}
                  placeholder="Alasan override..."
                  className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => resetCardOverride(editCardId)}
                disabled={savingEdit}
                className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                title="Hapus semua override, pakai data asli dari Trello"
              >
                Reset Override
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => !savingEdit && setEditCardId(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
                  Batal
                </button>
                <button
                  onClick={saveCardEdit}
                  disabled={savingEdit}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {savingEdit ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
