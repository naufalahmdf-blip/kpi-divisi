import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateAchievement, calculateWeightedScore, getGrade } from '@/lib/utils';
import { aggregateAllUsers } from '@/lib/aggregation';
import { calculateAttendanceScore, calculateFinalScore } from '@/lib/attendance';

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const periodType = searchParams.get('period_type') || 'monthly';
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
  const week = searchParams.get('week') ? parseInt(searchParams.get('week')!) : null;
  const type = searchParams.get('type') || 'employee';

  const { data: divisions } = await supabaseAdmin.from('divisions').select('*').order('name');

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, division_id, avatar_url, divisions(id, name, slug)')
    .eq('is_active', true)
    .eq('role', 'user');

  const { data: templates } = await supabaseAdmin
    .from('kpi_templates')
    .select('*')
    .order('sort_order');

  // Fetch entries - always weekly
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

  // Fetch attendance for the period
  const { data: attendanceData } = await supabaseAdmin
    .from('attendance_entries')
    .select('*')
    .eq('year', year)
    .eq('month', month);

  const getAttendance = (userId: string) =>
    (attendanceData || []).find((a) => a.user_id === userId) ?? null;

  // Build actual value lookup
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

  if (type === 'employee') {
    const employeeScores = (users || []).map((u) => {
      const userTemplates = (templates || []).filter((t) => t.division_id === u.division_id);

      let kpiTotal = 0;
      const scores = userTemplates.map((t) => {
        const actual = getActual(u.id, t.id);
        const achievement = calculateAchievement(actual, Number(t.target), t.formula_type as 'higher_better' | 'lower_better');
        const weighted = calculateWeightedScore(achievement, Number(t.weight));
        kpiTotal += weighted;
        return {
          template_id: t.id,
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
        division: (u.divisions as unknown as { id: string; name: string; slug: string } | null)?.name || 'N/A',
        division_id: u.division_id,
        totalScore,
        grade: getGrade(totalScore, 120),
        scores,
      };
    });

    employeeScores.sort((a, b) => b.totalScore - a.totalScore);
    return NextResponse.json({ leaderboard: employeeScores, type: 'employee' });
  } else {
    const divisionScores = (divisions || []).map((d) => {
      const divUsers = (users || []).filter((u) => u.division_id === d.id);
      const divTemplates = (templates || []).filter((t) => t.division_id === d.id);

      if (divUsers.length === 0) {
        return {
          id: d.id, name: d.name, slug: d.slug,
          averageScore: 0, grade: 'D' as string, userCount: 0,
          categoryBreakdown: [] as { category: string; avgScore: number }[],
        };
      }

      let totalDivScore = 0;
      const categoryScoresMap: Record<string, number[]> = {};

      divUsers.forEach((u) => {
        let kpiTotal = 0;
        divTemplates.forEach((t) => {
          const actual = getActual(u.id, t.id);
          const achievement = calculateAchievement(actual, Number(t.target), t.formula_type as 'higher_better' | 'lower_better');
          const weighted = calculateWeightedScore(achievement, Number(t.weight));
          kpiTotal += weighted;

          if (!categoryScoresMap[t.category]) categoryScoresMap[t.category] = [];
          categoryScoresMap[t.category].push(weighted);
        });
        const attendanceScore = calculateAttendanceScore(getAttendance(u.id));
        totalDivScore += calculateFinalScore(kpiTotal, attendanceScore);
      });

      const avgScore = totalDivScore / divUsers.length;
      const categoryBreakdown = Object.entries(categoryScoresMap).map(([category, scores]) => ({
        category,
        avgScore: scores.reduce((a, b) => a + b, 0) / divUsers.length,
      }));

      return {
        id: d.id, name: d.name, slug: d.slug,
        averageScore: Math.round(avgScore * 100) / 100,
        grade: getGrade(avgScore, 120),
        userCount: divUsers.length,
        categoryBreakdown,
      };
    });

    divisionScores.sort((a, b) => b.averageScore - a.averageScore);
    return NextResponse.json({ leaderboard: divisionScores, type: 'division' });
  }
}
