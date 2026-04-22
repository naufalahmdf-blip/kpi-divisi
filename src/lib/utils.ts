import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateAchievement(
  actual: number,
  target: number,
  formulaType: 'higher_better' | 'lower_better'
): number {
  if (target === 0) {
    if (formulaType === 'lower_better') {
      return actual === 0 ? 1 : 0;
    }
    return 0;
  }

  if (actual === 0) return 0;

  if (formulaType === 'higher_better') {
    // capped at 1 — overshoot tidak memberi bonus, hanya "mempertahankan 100"
    return Math.min(actual / target, 1);
  } else {
    // lower_better: capped at 1 (can't do better than perfect)
    if (actual <= target) return 1;
    return target / actual;
  }
}

export function calculateWeightedScore(achievement: number, weight: number): number {
  return achievement * weight;
}

/** Fixed 4 weeks per month. Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-end */
export function getWeeksInMonth(): number {
  return 4;
}

/**
 * Returns the calendar date range for a given week slot in a month.
 * Week 1: 1-7, Week 2: 8-14, Week 3: 15-21, Week 4: 22-end of month.
 * Range is inclusive: start = 00:00:00.000, end = 23:59:59.999.
 */
export function getWeekDateRange(year: number, month: number, week: number): { start: Date; end: Date } {
  const startDay = (week - 1) * 7 + 1;
  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const endDay = week === 4 ? lastDayOfMonth : Math.min(week * 7, lastDayOfMonth);
  return {
    start: new Date(year, month - 1, startDay, 0, 0, 0, 0),
    end: new Date(year, month - 1, endDay, 23, 59, 59, 999),
  };
}

/**
 * For higher_better KPIs in weekly view, divide target by weeksInMonth.
 * lower_better targets stay the same (averaged, not summed).
 * Rate KPI targets are percentages — never divided by weeks.
 */
export function getEffectiveTarget(
  target: number,
  formulaType: string,
  periodType: string,
  weeksInMonth: number,
  isRate: boolean = false,
  isFixedTarget: boolean = false
): number {
  if (isRate || isFixedTarget) return target;
  if (periodType === 'weekly' && formulaType === 'higher_better' && weeksInMonth > 0) {
    return Math.round((target / weeksInMonth) * 100) / 100;
  }
  return target;
}

/**
 * Grade based on percentage of max score.
 * @param score  Raw score (e.g. 0–100 for KPI-only, 0–120 for KPI+Absensi)
 * @param max    Maximum possible score (default 100)
 */
export function getGrade(score: number, max: number = 100): string {
  const pct = (score / max) * 100;
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  return 'D';
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-500';
    case 'B': return 'text-blue-500';
    case 'C': return 'text-amber-500';
    case 'D': return 'text-red-500';
    default: return 'text-gray-500';
  }
}

export function getGradeBg(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald-500/10 border-emerald-500/20';
    case 'B': return 'bg-blue-500/10 border-blue-500/20';
    case 'C': return 'bg-amber-500/10 border-amber-500/20';
    case 'D': return 'bg-red-500/10 border-red-500/20';
    default: return 'bg-gray-500/10 border-gray-500/20';
  }
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getMonthName(month: number): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return months[month - 1] || '';
}

export function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const week = Math.min(Math.ceil(day / 7), 4);
  return { year, month, week };
}
