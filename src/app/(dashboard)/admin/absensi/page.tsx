'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarCheck, Pencil, X, CheckCircle, AlertCircle, Users } from 'lucide-react';
import { cn, getMonthName, getCurrentPeriod } from '@/lib/utils';
import { calculateAttendanceScore, getAttendanceRates } from '@/lib/attendance';

interface AttendanceEntry {
  id?: string;
  user_id: string;
  year: number;
  month: number;
  hari_kerja: number;
  hadir: number;
  terlambat: number;
  sakit: number;
  cuti: number;
}

interface UserAttendance {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  division: string;
  attendance: AttendanceEntry | null;
}

interface ModalState {
  open: boolean;
  user: UserAttendance | null;
  form: { hari_kerja: string; hadir: string; terlambat: string; sakit: string; cuti: string };
}

export default function AdminAbsensiPage() {
  const currentPeriod = getCurrentPeriod();
  const [year, setYear] = useState(currentPeriod.year);
  const [month, setMonth] = useState(currentPeriod.month);
  const [users, setUsers] = useState<UserAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    user: null,
    form: { hari_kerja: '', hadir: '', terlambat: '', sakit: '', cuti: '' },
  });
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/absensi?year=${year}&month=${month}`);
      const json = await res.json();
      if (res.ok) setUsers(json.users || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openModal = (u: UserAttendance) => {
    const a = u.attendance;
    setModal({
      open: true,
      user: u,
      form: {
        hari_kerja: a ? String(a.hari_kerja) : '',
        hadir: a ? String(a.hadir) : '',
        terlambat: a ? String(a.terlambat) : '',
        sakit: a ? String(a.sakit) : '',
        cuti: a ? String(a.cuti) : '',
      },
    });
  };

  const closeModal = () => setModal((m) => ({ ...m, open: false, user: null }));

  const parseNum = (v: string) => parseInt(v) || 0;

  const formValues = {
    hari_kerja: parseNum(modal.form.hari_kerja),
    hadir: parseNum(modal.form.hadir),
    terlambat: parseNum(modal.form.terlambat),
    sakit: parseNum(modal.form.sakit),
    cuti: parseNum(modal.form.cuti),
  };

  const { attendanceRate, lateRate, tidakHadir } = getAttendanceRates(
    formValues.hari_kerja > 0 ? formValues : null
  );
  const previewScore = calculateAttendanceScore(formValues.hari_kerja > 0 ? formValues : null);

  const handleSave = async () => {
    if (!modal.user) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: modal.user.id,
          year,
          month,
          ...formValues,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        showToast('Data absensi berhasil disimpan', 'success');
        closeModal();
        fetchData();
      } else {
        showToast(json.error || 'Gagal menyimpan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filledCount = users.filter((u) => u.attendance !== null).length;

  const years = Array.from({ length: 3 }, (_, i) => currentPeriod.year - 1 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium shadow-lg',
          toast.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        )}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <CalendarCheck className="w-6 h-6 sm:w-7 sm:h-7 text-brand-300 flex-shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">Manajemen Absensi</h1>
            <p className="text-gray-500 text-xs sm:text-sm">Input data kehadiran karyawan per bulan</p>
          </div>
        </div>
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="bg-[#1a1a2e] border border-white/[0.08] text-white text-xs sm:text-sm rounded-lg px-2.5 py-1.5 sm:px-4 sm:py-2.5 focus:outline-none focus:border-brand-500"
          >
            {months.map((m) => (
              <option key={m} value={m}>{getMonthName(m)}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="bg-[#1a1a2e] border border-white/[0.08] text-white text-xs sm:text-sm rounded-lg px-2.5 py-1.5 sm:px-4 sm:py-2.5 focus:outline-none focus:border-brand-500"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-brand-300" />
            <p className="text-xs text-gray-500">Total Karyawan</p>
          </div>
          <p className="text-2xl font-bold text-white">{users.length}</p>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-gray-500">Sudah Diisi</p>
          </div>
          <p className="text-2xl font-bold text-white">{filledCount}</p>
        </div>
        <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-gray-500">Belum Diisi</p>
          </div>
          <p className="text-2xl font-bold text-white">{users.length - filledCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white">
            Data Absensi — {getMonthName(month)} {year}
          </h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Karyawan', 'Divisi', 'Hari Kerja', 'Hadir', 'Terlambat', 'Sakit', 'Cuti', 'Kehadiran', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {users.map((u) => {
                    const a = u.attendance;
                    const rates = getAttendanceRates(a);
                    const score = calculateAttendanceScore(a);
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-xs overflow-hidden flex-shrink-0">
                              {u.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                u.full_name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="text-white font-medium text-xs">{u.full_name}</p>
                              <p className="text-gray-500 text-[11px]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{u.division}</td>
                        <td className="px-4 py-3 text-xs text-gray-300 text-center">{a ? a.hari_kerja : '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-300 text-center">{a ? a.hadir : '—'}</td>
                        <td className="px-4 py-3 text-xs text-amber-400 text-center font-medium">{a ? a.terlambat : '—'}</td>
                        <td className="px-4 py-3 text-xs text-blue-400 text-center">{a ? a.sakit : '—'}</td>
                        <td className="px-4 py-3 text-xs text-purple-400 text-center">{a ? a.cuti : '—'}</td>
                        <td className="px-4 py-3 text-xs">
                          {a ? (
                            <div>
                              <p className={cn('font-semibold', rates.attendanceRate >= 90 ? 'text-emerald-400' : rates.attendanceRate >= 75 ? 'text-amber-400' : 'text-red-400')}>
                                {rates.attendanceRate.toFixed(1)}%
                              </p>
                              <p className="text-gray-500 text-[11px]">{score.toFixed(1)}/20 pts</p>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border',
                            a
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          )}>
                            {a ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                            {a ? 'Diisi' : 'Belum'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openModal(u)}
                            className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-brand-500/20 text-gray-500 hover:text-brand-400 transition-colors"
                            title="Edit Absensi"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/[0.04]">
              {users.map((u) => {
                const a = u.attendance;
                const rates = getAttendanceRates(a);
                const score = calculateAttendanceScore(a);
                return (
                  <div key={u.id} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        u.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.division}</p>
                      {a ? (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Hadir: {a.hadir}/{a.hari_kerja} &bull; Kehadiran: {rates.attendanceRate.toFixed(1)}% &bull; {score.toFixed(1)} pts
                        </p>
                      ) : (
                        <p className="text-xs text-amber-400 mt-0.5">Belum diisi</p>
                      )}
                    </div>
                    <button
                      onClick={() => openModal(u)}
                      className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-brand-500/20 text-gray-500 hover:text-brand-400 transition-colors flex-shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {users.length === 0 && (
              <div className="p-8 text-center text-gray-500 text-sm">Tidak ada karyawan aktif</div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {modal.open && modal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md bg-[#12121a] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
              <div>
                <h3 className="text-base font-semibold text-white">Input Absensi</h3>
                <p className="text-xs text-gray-500 mt-0.5">{modal.user.full_name} — {getMonthName(month)} {year}</p>
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Input Grid */}
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'hari_kerja', label: 'Hari Kerja', color: 'text-white' },
                  { key: 'hadir', label: 'Hadir', color: 'text-emerald-400' },
                  { key: 'terlambat', label: 'Terlambat', color: 'text-amber-400' },
                  { key: 'sakit', label: 'Sakit', color: 'text-blue-400' },
                  { key: 'cuti', label: 'Cuti', color: 'text-purple-400' },
                ] as { key: keyof typeof modal.form; label: string; color: string }[]).map(({ key, label, color }) => (
                  <div key={key} className={key === 'hari_kerja' ? 'col-span-2' : ''}>
                    <label className={cn('text-xs font-medium mb-1.5 block', color)}>{label}</label>
                    <input
                      type="number"
                      min="0"
                      value={modal.form[key]}
                      onChange={(e) => setModal((m) => ({ ...m, form: { ...m.form, [key]: e.target.value } }))}
                      className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-brand-500 transition-colors"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              {/* Auto-calculated Tidak Hadir */}
              <div className="bg-white/[0.04] rounded-xl p-3">
                <p className="text-xs text-gray-500">
                  Tidak Hadir (auto) = Hari Kerja − Hadir − Sakit − Cuti = <span className="text-red-400 font-semibold">{tidakHadir}</span> hari
                </p>
              </div>

              {/* Preview Score */}
              {formValues.hari_kerja > 0 && (
                <div className="bg-[#0c0c14] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preview Skor Absensi</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300">Kehadiran ({attendanceRate.toFixed(1)}% / target 90%)</span>
                        <span className="text-xs font-bold text-emerald-400">
                          {(Math.min(attendanceRate / 90, 1) * 15).toFixed(1)}/15
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(attendanceRate / 90 * 100, 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300">Keterlambatan ({lateRate.toFixed(1)}% / target ≤5%)</span>
                        <span className="text-xs font-bold text-amber-400">
                          {((lateRate <= 5 ? 1 : 5 / lateRate) * 5).toFixed(1)}/5
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${(lateRate <= 5 ? 1 : 5 / lateRate) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                    <span className="text-xs font-semibold text-white">Total Skor Absensi</span>
                    <span className="text-base font-bold text-brand-300">{previewScore.toFixed(1)} / 20 pts</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || formValues.hari_kerja === 0}
                className="px-5 py-2 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
