import { NextRequest, NextResponse } from 'next/server';
import { deleteSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity, getClientIp } from '@/lib/activity-log';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value;

  if (token) {
    // Look up user before deleting session
    const { data: session } = await supabaseAdmin
      .from('sessions')
      .select('user_id')
      .eq('token', token)
      .single();

    if (session) {
      const { data: logoutUser } = await supabaseAdmin
        .from('users')
        .select('id, email, full_name')
        .eq('id', session.user_id)
        .single();

      await deleteSession(token);

      if (logoutUser) {
        await logActivity({
          userId: logoutUser.id, userName: logoutUser.full_name, userEmail: logoutUser.email,
          action: 'LOGOUT', entityType: 'AUTH', entityId: logoutUser.id,
          details: {},
          ipAddress: getClientIp(request.headers),
        });
      }
    } else {
      await deleteSession(token);
    }
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('session_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
