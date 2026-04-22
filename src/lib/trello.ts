import { supabaseAdmin } from '@/lib/supabase';
import { getWeekDateRange } from '@/lib/utils';

/**
 * Hitung OTD dari snapshot DB (`trello_card_snapshots`).
 * Admin harus trigger sync via POST /api/admin/trello/sync untuk pull dari Trello.
 * Card dengan excluded=true atau deleted_on_trello=true diskip.
 */
export async function fetchTrelloOtd(
  divisionId: string,
  year: number,
  month: number,
  week?: number | null
): Promise<{ otdPercentage: number; onTime: number; late: number; total: number } | null> {
  const weekRange = week && week >= 1 && week <= 4 ? getWeekDateRange(year, month, week) : null;

  // Scope period: start-end bulan, atau start-end minggu kalau weekly
  const periodStart = weekRange
    ? weekRange.start
    : new Date(year, month - 1, 1, 0, 0, 0, 0);
  const periodEnd = weekRange
    ? weekRange.end
    : new Date(year, month, 0, 23, 59, 59, 999);

  const { data: snapshots, error } = await supabaseAdmin
    .from('trello_card_snapshots')
    .select('is_on_time, due, excluded, deleted_on_trello')
    .eq('division_id', divisionId)
    .eq('excluded', false)
    .eq('deleted_on_trello', false)
    .gte('due', periodStart.toISOString())
    .lte('due', periodEnd.toISOString());

  if (error || !snapshots) return null;

  let onTime = 0;
  let late = 0;
  for (const s of snapshots) {
    if (s.is_on_time === true) onTime++;
    else if (s.is_on_time === false) late++;
    // null → data belum lengkap (no due atau no completed) → skip
  }

  const total = onTime + late;
  if (total === 0) return { otdPercentage: 0, onTime: 0, late: 0, total: 0 };

  const otdPercentage = Math.round((onTime / total) * 10000) / 100;
  return { otdPercentage, onTime, late, total };
}
