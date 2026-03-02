import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity, getClientIp } from '@/lib/activity-log';

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, email, full_name, role, division_id, is_active, created_at, divisions(id, name)')
    .order('created_at', { ascending: false });

  return NextResponse.json({ users: users || [] });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, password, full_name, role, division_id } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        full_name,
        role: role || 'user',
        division_id: division_id || null,
      })
      .select('id, email, full_name, role, division_id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity({
      userId: user.id,
      userName: user.full_name,
      userEmail: user.email,
      action: 'CREATE',
      entityType: 'USER',
      entityId: data.id,
      details: { target_email: data.email, target_name: data.full_name, role: data.role, division_id: data.division_id },
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ user: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { id, email, full_name, role, division_id, is_active, password } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID diperlukan' }, { status: 400 });
    }

    // Fetch old data for change tracking
    const { data: oldUser } = await supabaseAdmin
      .from('users')
      .select('email, full_name, role, division_id, is_active')
      .eq('id', id)
      .single();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (email) updateData.email = email.toLowerCase().trim();
    if (full_name) updateData.full_name = full_name;
    if (role) updateData.role = role;
    if (division_id !== undefined) updateData.division_id = division_id || null;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (password) updateData.password_hash = await bcrypt.hash(password, 10);

    const { error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const changes: Record<string, unknown> = {};
    if (email && oldUser && email.toLowerCase().trim() !== oldUser.email) changes.email = { from: oldUser.email, to: email.toLowerCase().trim() };
    if (full_name && oldUser && full_name !== oldUser.full_name) changes.full_name = { from: oldUser.full_name, to: full_name };
    if (role && oldUser && role !== oldUser.role) changes.role = { from: oldUser.role, to: role };
    if (division_id !== undefined && oldUser && division_id !== oldUser.division_id) changes.division_id = { from: oldUser.division_id, to: division_id };
    if (is_active !== undefined && oldUser && is_active !== oldUser.is_active) changes.is_active = { from: oldUser.is_active, to: is_active };
    if (password) changes.password_changed = true;

    await logActivity({
      userId: user.id,
      userName: user.full_name,
      userEmail: user.email,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: id,
      details: { target_name: oldUser?.full_name || full_name, changes },
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'User ID diperlukan' }, { status: 400 });
  }

  if (id === user.id) {
    return NextResponse.json({ error: 'Tidak bisa menghapus akun sendiri' }, { status: 400 });
  }

  const { data: targetUser } = await supabaseAdmin
    .from('users')
    .select('email, full_name')
    .eq('id', id)
    .single();

  const { error } = await supabaseAdmin.from('users').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    userId: user.id,
    userName: user.full_name,
    userEmail: user.email,
    action: 'DELETE',
    entityType: 'USER',
    entityId: id,
    details: { deleted_email: targetUser?.email, deleted_name: targetUser?.full_name },
    ipAddress: getClientIp(request.headers),
  });

  return NextResponse.json({ success: true });
}
