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
 * Kehadiran:    target 95%, higher_better, weight 15
 *   kehadiranRate = hadir / (hadir + tidak_hadir) × 100  (sakit & cuti excluded)
 * Tepat Waktu:  target 90%, higher_better, weight 5
 *   tepatWaktuRate = (hadir - terlambat) / hadir × 100  (0 if hadir = 0)
 */
export function calculateAttendanceScore(entry: AttendanceEntry | null): number {
  if (!entry || entry.hari_kerja === 0) return 0;

  const tidakHadir = Math.max(0, entry.hari_kerja - entry.hadir - entry.sakit - entry.cuti);
  const kehadiranDenom = entry.hadir + tidakHadir; // exclude sakit & cuti
  const kehadiranRate = kehadiranDenom > 0 ? (entry.hadir / kehadiranDenom) * 100 : 100;
  const tepatWaktuRate = entry.hadir > 0
    ? ((entry.hadir - entry.terlambat) / entry.hadir) * 100
    : 0;

  const kehadiranScore = Math.min(kehadiranRate / 95, 1) * 15;
  const tepatWaktuScore = Math.min(tepatWaktuRate / 90, 1) * 5;

  return kehadiranScore + tepatWaktuScore; // 0–20
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
 * attendanceRate  = hadir / (hadir + tidak_hadir) × 100  (sakit & cuti excluded)
 * tepatWaktuRate  = (hadir - terlambat) / hadir × 100  (matches Excel "Persentase Tepat Waktu")
 */
export function getAttendanceRates(entry: AttendanceEntry | null): {
  attendanceRate: number;
  tepatWaktuRate: number;
  tidakHadir: number;
} {
  if (!entry || entry.hari_kerja === 0) {
    return { attendanceRate: 0, tepatWaktuRate: 0, tidakHadir: 0 };
  }
  const tidakHadir = Math.max(0, entry.hari_kerja - entry.hadir - entry.sakit - entry.cuti);
  const kehadiranDenom = entry.hadir + tidakHadir;
  const attendanceRate = kehadiranDenom > 0 ? (entry.hadir / kehadiranDenom) * 100 : 100;
  const tepatWaktuRate = entry.hadir > 0
    ? ((entry.hadir - entry.terlambat) / entry.hadir) * 100
    : 0;
  return { attendanceRate, tepatWaktuRate, tidakHadir };
}
