import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { calculateAchievement, calculateWeightedScore, getGrade } from '@/lib/utils';
import { aggregateAllUsers } from '@/lib/aggregation';

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!user.division_id) {
    return NextResponse.json({ error: 'Anda belum memiliki divisi' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const periodType = searchParams.get('period_type') || 'monthly';
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
  const week = searchParams.get('week') ? parseInt(searchParams.get('week')!) : null;

  // Fetch division
  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select('id, name, slug')
    .eq('id', user.division_id)
    .single();

  // Fetch users in this division
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, avatar_url, division_id')
    .eq('division_id', user.division_id)
    .eq('is_active', true)
    .eq('role', 'user');

  // Fetch templates for this division
  const { data: templates } = await supabaseAdmin
    .from('kpi_templates')
    .select('*')
    .eq('division_id', user.division_id)
    .order('sort_order');

  // Fetch entries
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

  // Compute scores per member
  let totalDivScore = 0;
  const categoryScoresMap: Record<string, number[]> = {};

  const members = (users || []).map((u) => {
    let totalScore = 0;
    (templates || []).forEach((t) => {
      const actual = getActual(u.id, t.id);
      const achievement = calculateAchievement(actual, Number(t.target), t.formula_type as 'higher_better' | 'lower_better');
      const weighted = calculateWeightedScore(achievement, Number(t.weight));
      totalScore += weighted;

      if (!categoryScoresMap[t.category]) categoryScoresMap[t.category] = [];
      categoryScoresMap[t.category].push(weighted);
    });

    totalDivScore += totalScore;

    return {
      id: u.id,
      name: u.full_name,
      avatar_url: u.avatar_url || null,
      totalScore: Math.round(totalScore * 100) / 100,
      grade: getGrade(totalScore),
    };
  });

  members.sort((a, b) => b.totalScore - a.totalScore);

  const avgScore = members.length > 0 ? totalDivScore / members.length : 0;
  const categoryBreakdown = Object.entries(categoryScoresMap).map(([category, scores]) => ({
    category,
    avgScore: members.length > 0 ? scores.reduce((a, b) => a + b, 0) / members.length : 0,
  }));

  // Find current user's rank
  const userRank = members.findIndex((m) => m.id === user.id) + 1;
  const userScore = members.find((m) => m.id === user.id)?.totalScore ?? 0;
  const topEmployee = members.length > 0 ? members[0] : null;

  return NextResponse.json({
    division,
    averageScore: Math.round(avgScore * 100) / 100,
    grade: getGrade(avgScore),
    userCount: members.length,
    categoryBreakdown,
    members,
    topEmployee,
    userRank,
    userScore,
  });
}
