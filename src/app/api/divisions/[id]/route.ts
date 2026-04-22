import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateAchievement, calculateWeightedScore, getGrade, getWeeksInMonth, getEffectiveTarget } from '@/lib/utils';
import { aggregateAllUsers, computeRateActual, isRateKpi, isOtdKpi } from '@/lib/aggregation';
import { calculateAttendanceScore, calculateFinalScore } from '@/lib/attendance';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: divisionId } = await params;

  const { searchParams } = new URL(request.url);
  const periodType = searchParams.get('period_type') || 'monthly';
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
  const week = searchParams.get('week') ? parseInt(searchParams.get('week')!) : null;
  const weeksInMonth = getWeeksInMonth();

  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select('id, name, slug')
    .eq('id', divisionId)
    .single();

  if (!division) {
    return NextResponse.json({ error: 'Divisi tidak ditemukan' }, { status: 404 });
  }

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, avatar_url, division_id')
    .eq('division_id', divisionId)
    .eq('is_active', true);

  const { data: templates } = await supabaseAdmin
    .from('kpi_templates')
    .select('*')
    .eq('division_id', divisionId)
    .order('sort_order');

  let entries: { user_id: string; template_id: string; actual_value: number }[] = [];

  if (periodType === 'monthly') {
    const { data } = await supabaseAdmin
      .from('kpi_entries')
      .select('*')
      .eq('period_type', 'weekly')
      .eq('year', year)
      .eq('month', month);
    entries = data || [];
  } else {
    const { data } = await supabaseAdmin
      .from('kpi_entries')
      .select('*')
      .eq('period_type', 'weekly')
      .eq('year', year)
      .eq('month', month)
      .eq('week', week!);
    entries = data || [];
  }

  const { data: attendanceData } = await supabaseAdmin
    .from('attendance_entries')
    .select('*')
    .eq('year', year)
    .eq('month', month);

  const getAttendance = (userId: string) =>
    (attendanceData || []).find((a) => a.user_id === userId) ?? null;

  const templateInfos = (templates || []).map((t) => ({
    id: t.id,
    formula_type: t.formula_type as 'higher_better' | 'lower_better',
  }));

  const userIds = (users || []).map((u) => u.id);

  let getActual: (userId: string, templateId: string) => number;

  if (periodType === 'monthly') {
    const aggregatedMap = aggregateAllUsers(entries, templateInfos, userIds);
    getActual = (userId, templateId) => aggregatedMap[userId]?.[templateId] ?? 0;
  } else {
    getActual = (userId, templateId) => {
      const entry = entries.find((e) => e.user_id === userId && e.template_id === templateId);
      return entry ? Number(entry.actual_value) : 0;
    };
  }

  // Wrap getActual to auto-compute rate KPIs
  const baseGetActual = getActual;
  getActual = (userId: string, templateId: string) => {
    const t = (templates || []).find((tpl) => tpl.id === templateId);
    if (t && isRateKpi(t)) {
      const rawValue = baseGetActual(userId, templateId);
      return computeRateActual(
        rawValue, t.denominator_template_id!,
        (tid) => baseGetActual(userId, tid)
      );
    }
    return baseGetActual(userId, templateId);
  };

  let totalDivScore = 0;
  const categoryScoresMap: Record<string, number[]> = {};

  const members = (users || []).map((u) => {
    let kpiTotal = 0;
    const scores = (templates || []).map((t) => {
      const actual = getActual(u.id, t.id);
      const achievement = calculateAchievement(actual, getEffectiveTarget(Number(t.target), t.formula_type, periodType, weeksInMonth, isRateKpi(t), isOtdKpi(t)), t.formula_type as 'higher_better' | 'lower_better');
      const weighted = calculateWeightedScore(achievement, Number(t.weight));
      kpiTotal += weighted;

      if (!categoryScoresMap[t.category]) categoryScoresMap[t.category] = [];
      categoryScoresMap[t.category].push(weighted);

      return {
        kpi_name: t.kpi_name,
        category: t.category,
        weight: Number(t.weight),
        target: Number(t.target),
        actual,
        achievement,
        weighted,
      };
    });

    const attendanceScore = calculateAttendanceScore(getAttendance(u.id));
    const totalScore = calculateFinalScore(kpiTotal, attendanceScore);
    totalDivScore += totalScore;

    return {
      id: u.id,
      name: u.full_name,
      email: u.email,
      avatar_url: u.avatar_url || null,
      totalScore: Math.round(totalScore * 100) / 100,
      grade: getGrade(totalScore, 100),
      scores,
    };
  });

  members.sort((a, b) => b.totalScore - a.totalScore);

  const avgScore = members.length > 0 ? totalDivScore / members.length : 0;
  const categoryBreakdown = Object.entries(categoryScoresMap).map(([category, scores]) => ({
    category,
    avgScore: members.length > 0 ? scores.reduce((a, b) => a + b, 0) / members.length : 0,
  }));

  return NextResponse.json({
    division,
    averageScore: Math.round(avgScore * 100) / 100,
    grade: getGrade(avgScore, 100),
    userCount: members.length,
    categoryBreakdown,
    members,
  });
}
