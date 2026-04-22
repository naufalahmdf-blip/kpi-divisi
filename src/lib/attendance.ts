export interface AttendanceEntry {
  id?: string;
  user_id?: string;
  year?: number;
  month?: number;
  hari_kerja: number;
  hadir: number;
  /** Total akumulasi keterlambatan dalam MENIT per bulan (bukan jumlah hari). */
  terlambat: number;
  sakit: number;
  cuti: number;
}

/** Toleransi keterlambatan akumulatif per bulan sebelum skor mulai dikurangi. */
export const LATENESS_BUFFER_MINUTES = 60;
/** Bobot keterlambatan di final score (5 dari total 100). */
export const LATENESS_MAX_SCORE = 5;

/**
 * Hitung skor keterlambatan (0–5 pts).
 *  • terlambat ≤ 60 menit  → 5 pts penuh
 *  • terlambat > 60 menit  → pro-rata: 5 × (60 / actualMinutes)
 * Entry kosong dianggap 0 menit terlambat (skor penuh).
 */
export function calculateAttendanceScore(entry: AttendanceEntry | null): number {
  if (!entry) return 0;
  const lateMinutes = Math.max(0, entry.terlambat || 0);
  if (lateMinutes <= LATENESS_BUFFER_MINUTES) return LATENESS_MAX_SCORE;
  return LATENESS_MAX_SCORE * (LATENESS_BUFFER_MINUTES / lateMinutes);
}

/**
 * Combine KPI score (0–100) dengan lateness score (0–5) → final (0–100).
 *   final = kpiTotal × 0.95 + latenessScore
 * Dengan asumsi bobot template tiap divisi sum = 100, ini menghasilkan max 100.
 */
export function calculateFinalScore(kpiTotal: number, latenessScore: number): number {
  return Math.round((kpiTotal * 0.95 + latenessScore) * 100) / 100;
}

/**
 * Derived display values dari raw attendance data.
 *   tidakHadir  = hari_kerja - hadir - sakit - cuti (minimum 0)
 *   lateMinutes = entry.terlambat (dalam menit)
 */
export function getAttendanceRates(entry: AttendanceEntry | null): {
  lateMinutes: number;
  tidakHadir: number;
  withinBuffer: boolean;
} {
  if (!entry || entry.hari_kerja === 0) {
    return { lateMinutes: 0, tidakHadir: 0, withinBuffer: true };
  }
  const tidakHadir = Math.max(0, entry.hari_kerja - entry.hadir - entry.sakit - entry.cuti);
  const lateMinutes = Math.max(0, entry.terlambat || 0);
  return {
    lateMinutes,
    tidakHadir,
    withinBuffer: lateMinutes <= LATENESS_BUFFER_MINUTES,
  };
}
