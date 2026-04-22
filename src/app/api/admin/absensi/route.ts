import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity, getClientIp } from '@/lib/activity-log';

// GET: Fetch all users with their attendance for a given month
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
  const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

  // Fetch all active users that belong to a division (admin included)
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, avatar_url, division_id, divisions(id, name)')
    .eq('is_active', true)
    .not('division_id', 'is', null)
    .order('full_name');

  // Fetch attendance entries for the period
  const { data: attendanceEntries } = await supabaseAdmin
    .from('attendance_entries')
    .select('*')
    .eq('year', year)
    .eq('month', month);

  // Merge
  const result = (users || []).map((u) => {
    const attendance = (attendanceEntries || []).find((a) => a.user_id === u.id) ?? null;
    return {
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      avatar_url: u.avatar_url,
      division_id: u.division_id,
      division: (u.divisions as unknown as { id: string; name: string } | null)?.name ?? 'N/A',
      attendance,
    };
  });

  return NextResponse.json({ users: result, period: { year, month } });
}

// POST: Save/update attendance for a user
export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { user_id, year, month, hari_kerja, hadir, terlambat, sakit, cuti } = body;

    if (!user_id || !year || !month) {
      return NextResponse.json({ error: 'user_id, year, month wajib diisi' }, { status: 400 });
    }

    if (terlambat != null && terlambat < 0) {
      return NextResponse.json({ error: 'Menit terlambat tidak boleh negatif' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('attendance_entries')
      .upsert(
        {
          user_id,
          year,
          month,
          hari_kerja: hari_kerja ?? 0,
          hadir: hadir ?? 0,
          terlambat: terlambat ?? 0,
          sakit: sakit ?? 0,
          cuti: cuti ?? 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,year,month' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity({
      userId: user.id,
      userName: user.full_name,
      userEmail: user.email,
      action: 'UPDATE',
      entityType: 'ATTENDANCE',
      entityId: user_id,
      details: { year, month, hari_kerja, hadir, terlambat, sakit, cuti },
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
