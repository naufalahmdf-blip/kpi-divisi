import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { createSession } from '@/lib/auth';
import { logActivity, getClientIp } from '@/lib/activity-log';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password harus diisi' }, { status: 400 });
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, password_hash, full_name, role, is_active')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !user) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: 'Akun Anda telah dinonaktifkan' }, { status: 403 });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Email atau password salah' }, { status: 401 });
    }

    const token = await createSession(user.id);

    await logActivity({
      userId: user.id, userName: user.full_name, userEmail: user.email,
      action: 'LOGIN', entityType: 'AUTH', entityId: user.id,
      details: { role: user.role },
      ipAddress: getClientIp(request.headers),
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
