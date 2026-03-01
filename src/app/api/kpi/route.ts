import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { aggregateWeeklyToMonthly } from '@/lib/aggregation';

// GET: Fetch KPI entries for current user or specified user (admin)
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id') || user.id;
  const periodType = searchParams.get('period_type') || 'monthly';
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
  const week = searchParams.get('week') ? parseInt(searchParams.get('week')!) : null;

  // Only admin can view other users' KPI
  if (userId !== user.id && user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get user's division
  const { data: targetUser } = await supabaseAdmin
    .from('users')
    .select('id, full_name, division_id, divisions(id, name, slug)')
    .eq('id', userId)
    .single();

  if (!targetUser || !targetUser.division_id) {
    return NextResponse.json({ error: 'User tidak memiliki divisi' }, { status: 400 });
  }

  // Get KPI templates for the division
  const { data: templates } = await supabaseAdmin
    .from('kpi_templates')
    .select('*')
    .eq('division_id', targetUser.division_id)
    .order('sort_order');

  if (periodType === 'monthly') {
    // Monthly: aggregate from ALL weekly entries in this month
    const { data: weeklyEntries } = await supabaseAdmin
      .from('kpi_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('period_type', 'weekly')
      .eq('year', year)
      .eq('month', month);

    const aggregated = aggregateWeeklyToMonthly(
      weeklyEntries || [],
      (templates || []).map((t) => ({ id: t.id, formula_type: t.formula_type as 'higher_better' | 'lower_better' }))
    );

    const syntheticEntries = aggregated.map((a) => ({
      id: `agg-${a.template_id}`,
      template_id: a.template_id,
      actual_value: a.actual_value,
      notes: null,
      weeks_filled: a.weeks_filled,
    }));

    return NextResponse.json({
      user: targetUser,
      templates: templates || [],
      entries: syntheticEntries,
      period: { type: 'monthly', year, month, week: null },
      is_aggregated: true,
    });
  }

  // Weekly: fetch specific week entries
  let query = supabaseAdmin
    .from('kpi_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('period_type', 'weekly')
    .eq('year', year)
    .eq('month', month);

  if (week) {
    query = query.eq('week', week);
  }

  const { data: entries } = await query;

  return NextResponse.json({
    user: targetUser,
    templates: templates || [],
    entries: entries || [],
    period: { type: 'weekly', year, month, week },
  });
}

// POST: Save/update KPI entries (weekly only)
export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { entries, period_type, year, month, week } = body;

    // Only allow weekly input
    if (period_type === 'monthly') {
      return NextResponse.json(
        { error: 'Data bulanan dihitung otomatis dari data mingguan. Silakan input data mingguan.' },
        { status: 400 }
      );
    }

    if (!week || week < 1 || week > 5) {
      return NextResponse.json(
        { error: 'Minggu harus antara 1-5' },
        { status: 400 }
      );
    }

    // Admin can submit for any user, users only for themselves
    const userId = body.user_id || user.id;
    if (userId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const upsertData = entries.map((entry: { template_id: string; actual_value: number; notes?: string }) => ({
      user_id: userId,
      template_id: entry.template_id,
      period_type: 'weekly',
      year,
      month,
      week,
      actual_value: entry.actual_value,
      notes: entry.notes || null,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from('kpi_entries')
      .upsert(upsertData, {
        onConflict: 'user_id,template_id,period_type,year,month,week',
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
