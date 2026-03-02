export interface AttendanceEntry {
  id?: string;
  user_id?: string;
  year?: number;
  month?: number;
  hari_kerja: number;
  hadir: number;
  terlambat: number;
  sakit: number;
  cuti: number;
}

/**
 * Calculate attendance score contribution (0–20 pts).
 * Kehadiran:      target 90%, higher_better, weight 15
 * Keterlambatan:  target 5%,  lower_better,  weight 5
 */
export function calculateAttendanceScore(entry: AttendanceEntry | null): number {
  if (!entry || entry.hari_kerja === 0) return 0;

  const attendanceRate = (entry.hadir / entry.hari_kerja) * 100;
  const lateRate = entry.hadir > 0 ? (entry.terlambat / entry.hadir) * 100 : 0;

  const kehadiranScore = Math.min(attendanceRate / 90, 1) * 15;
  const keterlambatanScore = (lateRate <= 5 ? 1 : 5 / lateRate) * 5;

  return kehadiranScore + keterlambatanScore; // 0–20
}

/**
 * Combine KPI score (0–100) with attendance score (0–20) into final score (0–120).
 * Final = KPI + Absensi  →  max 120
 */
export function calculateFinalScore(kpiTotal: number, attendanceScore: number): number {
  return Math.round((kpiTotal + attendanceScore) * 100) / 100;
}

/**
 * Compute display rates from raw attendance data.
 */
export function getAttendanceRates(entry: AttendanceEntry | null): {
  attendanceRate: number;
  lateRate: number;
  tidakHadir: number;
} {
  if (!entry || entry.hari_kerja === 0) {
    return { attendanceRate: 0, lateRate: 0, tidakHadir: 0 };
  }
  const attendanceRate = (entry.hadir / entry.hari_kerja) * 100;
  const lateRate = entry.hadir > 0 ? (entry.terlambat / entry.hadir) * 100 : 0;
  const tidakHadir = Math.max(0, entry.hari_kerja - entry.hadir - entry.sakit - entry.cuti);
  return { attendanceRate, lateRate, tidakHadir };
}
