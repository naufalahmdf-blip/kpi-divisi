import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateAchievement, calculateWeightedScore, getGrade, getWeeksInMonth, getEffectiveTarget } from '@/lib/utils';
import { aggregateAllUsers, computeRateActual, isRateKpi } from '@/lib/aggregation';
import { calculateAttendanceScore, calculateFinalScore } from '@/lib/attendance';

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const periodType = searchParams.get('period_type') || 'monthly';
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
  const week = searchParams.get('week') ? parseInt(searchParams.get('week')!) : null;
  const weeksInMonth = getWeeksInMonth();

  // Get divisions
  const { data: divisions } = await supabaseAdmin.from('divisions').select('*').order('name');

  // Get all active users with a division (admin included — they're also employees)
  const { data: allUsers } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, avatar_url, division_id, role, divisions(id, name)')
    .eq('is_active', true)
    .not('division_id', 'is', null);

  // Get templates
  const { data: templates } = await supabaseAdmin.from('kpi_templates').select('*').order('sort_order');

  // Get entries - always fetch weekly entries
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

  // Fetch attendance entries for the period
  const { data: attendanceData } = await supabaseAdmin
    .from('attendance_entries')
    .select('*')
    .eq('year', year)
    .eq('month', month);

  const getAttendance = (userId: string) =>
    (attendanceData || []).find((a) => a.user_id === userId) ?? null;

  // Pre-compute aggregated actuals for monthly mode
  const userIds = (allUsers || []).map((u) => u.id);
  if (user.division_id && !userIds.includes(user.id)) {
    userIds.push(user.id);
  }

  const templateInfos = (templates || []).map((t) => ({
    id: t.id,
    formula_type: t.formula_type as 'higher_better' | 'lower_better',
  }));

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

  // For regular user: compute their own score
  let myScore = null;
  let myGrade = null;
  let myScores: { kpi_name: string; category: string; weighted: number; achievement: number; weight: number }[] = [];

  if (user.division_id) {
    const myTemplates = (templates || []).filter((t) => t.division_id === user.division_id);
    let kpiTotal = 0;

    myScores = myTemplates.map((t) => {
      const actual = getActual(user.id, t.id);
      const achievement = calculateAchievement(actual, getEffectiveTarget(Number(t.target), t.formula_type, periodType, weeksInMonth, isRateKpi(t)), t.formula_type as 'higher_better' | 'lower_better');
      const weighted = calculateWeightedScore(achievement, Number(t.weight));
      kpiTotal += weighted;
      return { kpi_name: t.kpi_name, category: t.category, weighted, achievement, weight: Number(t.weight) };
    });

    const attendanceScore = calculateAttendanceScore(getAttendance(user.id));
    const finalTotal = calculateFinalScore(kpiTotal, attendanceScore);
    myScore = finalTotal;
    myGrade = getGrade(finalTotal, 120);
  }

  // Division summary
  const divisionSummary = (divisions || []).map((d) => {
    const divUsers = (allUsers || []).filter((u) => u.division_id === d.id);
    const divTemplates = (templates || []).filter((t) => t.division_id === d.id);

    if (divUsers.length === 0) {
      return { ...d, averageScore: 0, grade: 'D', userCount: 0 };
    }

    let totalDiv = 0;
    divUsers.forEach((u) => {
      let kpiTotal = 0;
      divTemplates.forEach((t) => {
        const actual = getActual(u.id, t.id);
        const achievement = calculateAchievement(actual, getEffectiveTarget(Number(t.target), t.formula_type, periodType, weeksInMonth, isRateKpi(t)), t.formula_type as 'higher_better' | 'lower_better');
        kpiTotal += calculateWeightedScore(achievement, Number(t.weight));
      });
      const attendanceScore = calculateAttendanceScore(getAttendance(u.id));
      totalDiv += calculateFinalScore(kpiTotal, attendanceScore);
    });

    const avg = totalDiv / divUsers.length;
    return { ...d, averageScore: Math.round(avg * 100) / 100, grade: getGrade(avg, 120), userCount: divUsers.length };
  });

  // Top 5 employees
  const employeeScores = (allUsers || []).map((u) => {
    const userTemplates = (templates || []).filter((t) => t.division_id === u.division_id);
    let kpiTotal = 0;

    const scores = userTemplates.map((t) => {
      const actual = getActual(u.id, t.id);
      const achievement = calculateAchievement(actual, getEffectiveTarget(Number(t.target), t.formula_type, periodType, weeksInMonth, isRateKpi(t)), t.formula_type as 'higher_better' | 'lower_better');
      const weighted = calculateWeightedScore(achievement, Number(t.weight));
      kpiTotal += weighted;
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

    return {
      id: u.id,
      name: u.full_name,
      email: u.email,
      avatar_url: u.avatar_url || null,
      division: (u.divisions as unknown as { name: string } | null)?.name || 'N/A',
      totalScore,
      grade: getGrade(totalScore, 120),
      scores,
    };
  });

  employeeScores.sort((a, b) => b.totalScore - a.totalScore);

  // Late employees — sorted by late rate descending (only those with attendance data)
  const lateEmployees = (allUsers || [])
    .map((u) => {
      const att = getAttendance(u.id);
      if (!att || att.hadir === 0) return null;
      const lateRate = (att.terlambat / att.hadir) * 100;
      return {
        id: u.id,
        name: u.full_name,
        division: (u.divisions as unknown as { name: string } | null)?.name || 'N/A',
        lateRate: Math.round(lateRate * 10) / 10,
        terlambat: att.terlambat,
        hadir: att.hadir,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => b.lateRate - a.lateRate)
    .slice(0, 5);

  return NextResponse.json({
    user: {
      ...user,
      score: myScore,
      grade: myGrade,
      scores: myScores,
    },
    divisionSummary,
    topEmployees: employeeScores.slice(0, 5),
    lateEmployees,
    stats: {
      totalUsers: allUsers?.length || 0,
      totalDivisions: divisions?.length || 0,
    },
    period: { type: periodType, year, month, week },
  });
}
