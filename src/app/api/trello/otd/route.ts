import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getWeekDateRange } from '@/lib/utils';

/**
 * GET /api/trello/otd?division_id=xxx&year=2026&month=3[&week=2]
 * Sumber data: trello_card_snapshots (DB). Bukan live Trello API.
 * Supaya data refresh, admin perlu klik sync: POST /api/admin/trello/sync.
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const divisionId = searchParams.get('division_id');
  const year = parseInt(searchParams.get('year') || '0');
  const month = parseInt(searchParams.get('month') || '0');
  const weekParam = searchParams.get('week');
  const week = weekParam ? parseInt(weekParam) : null;

  if (!divisionId) {
    return NextResponse.json({ error: 'division_id diperlukan' }, { status: 400 });
  }

  // Period scope
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  if (year > 0 && month > 0) {
    const weekRange = week && week >= 1 && week <= 4 ? getWeekDateRange(year, month, week) : null;
    periodStart = weekRange ? weekRange.start : new Date(year, month - 1, 1, 0, 0, 0, 0);
    periodEnd = weekRange ? weekRange.end : new Date(year, month, 0, 23, 59, 59, 999);
  }

  let query = supabaseAdmin
    .from('trello_card_snapshots')
    .select('*')
    .eq('division_id', divisionId)
    .eq('deleted_on_trello', false)
    .order('due', { ascending: true });

  if (periodStart && periodEnd) {
    query = query.gte('due', periodStart.toISOString()).lte('due', periodEnd.toISOString());
  }

  const { data: snapshots, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let onTime = 0;
  let late = 0;
  type Snapshot = {
    card_id: string;
    name: string | null;
    list_name: string | null;
    board_name: string | null;
    due: string | null;
    completed_at: string | null;
    is_on_time: boolean | null;
    excluded: boolean;
    member_names: string[] | null;
    admin_note: string | null;
    due_overridden: boolean;
    completed_at_overridden: boolean;
    is_on_time_overridden: boolean;
  };
  const typedSnapshots = (snapshots || []) as Snapshot[];

  const details = typedSnapshots.map((s) => {
    const isOnTime = s.is_on_time;
    if (!s.excluded) {
      if (isOnTime === true) onTime++;
      else if (isOnTime === false) late++;
    }
    return {
      card_id: s.card_id,
      name: s.name,
      list: s.list_name,
      board: s.board_name,
      due: s.due,
      completed: s.completed_at,
      is_on_time: isOnTime ?? false,
      excluded: s.excluded,
      members: s.member_names || [],
      admin_note: s.admin_note,
      due_overridden: s.due_overridden,
      completed_at_overridden: s.completed_at_overridden,
      is_on_time_overridden: s.is_on_time_overridden,
      // Back-compat field utk UI existing (original_due, due_changed)
      original_due: null,
      due_changed: false,
    };
  });

  const total = onTime + late;
  const otdPercentage = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;

  return NextResponse.json({
    otd_percentage: otdPercentage,
    on_time: onTime,
    late,
    total,
    details,
  });
}
