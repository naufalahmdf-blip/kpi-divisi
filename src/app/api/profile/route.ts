import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Get current user profile
export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, division_id, avatar_url, created_at, divisions(id, name)')
    .eq('id', user.id)
    .single();

  return NextResponse.json({ profile });
}

// PUT: Update profile (name, avatar)
export async function PUT(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { full_name, avatar_url } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) updateData.full_name = full_name;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;

    const { error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// POST: Change password
export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { current_password, new_password } = await request.json();

    if (!current_password || !new_password) {
      return NextResponse.json({ error: 'Password lama dan baru harus diisi' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: 'Password baru minimal 6 karakter' }, { status: 400 });
    }

    // Verify current password
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('password_hash')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 });
    }

    const isValid = await bcrypt.compare(current_password, userData.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Password lama salah' }, { status: 401 });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    const { error } = await supabaseAdmin
      .from('users')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
