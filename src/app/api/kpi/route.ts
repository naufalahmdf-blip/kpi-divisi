import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { aggregateWeeklyToMonthly, computeRateActual, isRateKpi } from '@/lib/aggregation';
import { logActivity, getClientIp } from '@/lib/activity-log';
import { calculateAttendanceScore } from '@/lib/attendance';

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

  // Fetch attendance entry for this user/month (always monthly)
  const { data: attendanceData } = await supabaseAdmin
    .from('attendance_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  const attendanceScore = calculateAttendanceScore(attendanceData);

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

    // Build lookup for aggregated actuals
    const aggMap: Record<string, number> = {};
    for (const a of aggregated) {
      aggMap[a.template_id] = a.actual_value;
    }

    // Compute rate KPI display values
    const rateDisplayValues: Record<string, number> = {};
    for (const t of (templates || [])) {
      if (isRateKpi(t)) {
        rateDisplayValues[t.id] = computeRateActual(
          aggMap[t.id] ?? 0, t.denominator_template_id!,
          (tid) => aggMap[tid] ?? 0
        );
      }
    }

    const syntheticEntries = aggregated.map((a) => ({
      id: `agg-${a.template_id}`,
      template_id: a.template_id,
      actual_value: a.actual_value,
      rate_display: rateDisplayValues[a.template_id] ?? null,
      notes: null,
      weeks_filled: a.weeks_filled,
    }));

    return NextResponse.json({
      user: targetUser,
      templates: templates || [],
      entries: syntheticEntries,
      period: { type: 'monthly', year, month, week: null },
      is_aggregated: true,
      attendance: attendanceData ?? null,
      attendanceScore,
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

  // Compute rate display values for weekly view
  const weeklyEntryMap: Record<string, number> = {};
  for (const e of (entries || [])) {
    weeklyEntryMap[e.template_id] = Number(e.actual_value);
  }

  const allEntries = (entries || []).map((e) => {
    const t = (templates || []).find((tpl) => tpl.id === e.template_id);
    const rateDisplay = t && isRateKpi(t)
      ? computeRateActual(
          Number(e.actual_value), t.denominator_template_id!,
          (tid) => weeklyEntryMap[tid] ?? 0
        )
      : null;
    return { ...e, rate_display: rateDisplay };
  });

  return NextResponse.json({
    user: targetUser,
    templates: templates || [],
    entries: allEntries,
    period: { type: 'weekly', year, month, week },
    attendance: attendanceData ?? null,
    attendanceScore,
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

    if (!week || week < 1 || week > 4) {
      return NextResponse.json(
        { error: 'Minggu harus antara 1-4' },
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

    await logActivity({
      userId: user.id, userName: user.full_name, userEmail: user.email,
      action: 'UPDATE', entityType: 'KPI_ENTRY', entityId: userId,
      details: {
        period: { type: 'weekly', year, month, week },
        entries_count: entries.length,
        ...(userId !== user.id ? { submitted_for: userId } : {}),
      },
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
