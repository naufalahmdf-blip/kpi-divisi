import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET: All employees + attendance for a given month — accessible to all authenticated users
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, avatar_url, division_id, divisions(id, name)')
    .eq('is_active', true)
    .not('division_id', 'is', null)
    .order('full_name');

  const { data: attendanceEntries } = await supabaseAdmin
    .from('attendance_entries')
    .select('*')
    .eq('year', year)
    .eq('month', month);

  const result = (users || []).map((u) => {
    const attendance = (attendanceEntries || []).find((a) => a.user_id === u.id) ?? null;
    return {
      id: u.id,
      full_name: u.full_name,
      avatar_url: u.avatar_url ?? null,
      division: (u.divisions as unknown as { name: string } | null)?.name ?? 'N/A',
      attendance,
    };
  });

  return NextResponse.json({ users: result, period: { year, month } });
}
