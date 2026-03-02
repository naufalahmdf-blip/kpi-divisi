import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity, getClientIp } from '@/lib/activity-log';

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: divisions } = await supabaseAdmin
    .from('divisions')
    .select('*')
    .order('name');

  return NextResponse.json({ divisions: divisions || [] });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama divisi harus diisi' }, { status: 400 });
    }

    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { data, error } = await supabaseAdmin
      .from('divisions')
      .insert({ name: name.trim(), slug })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Divisi dengan nama tersebut sudah ada' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity({
      userId: user.id, userName: user.full_name, userEmail: user.email,
      action: 'CREATE', entityType: 'DIVISION', entityId: data.id,
      details: { name: data.name, slug: data.slug },
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ division: data }, { status: 201 });
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
    const { id, name } = await request.json();

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: 'ID dan nama divisi harus diisi' }, { status: 400 });
    }

    const { data: oldDiv } = await supabaseAdmin.from('divisions').select('name').eq('id', id).single();

    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const { error } = await supabaseAdmin
      .from('divisions')
      .update({ name: name.trim(), slug })
      .eq('id', id);

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Divisi dengan nama tersebut sudah ada' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await logActivity({
      userId: user.id, userName: user.full_name, userEmail: user.email,
      action: 'UPDATE', entityType: 'DIVISION', entityId: id,
      details: { name: { from: oldDiv?.name, to: name.trim() } },
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
    return NextResponse.json({ error: 'Division ID diperlukan' }, { status: 400 });
  }

  // Check if division has users
  const { count } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('division_id', id);

  if (count && count > 0) {
    return NextResponse.json({ error: `Divisi masih memiliki ${count} user. Pindahkan user terlebih dahulu.` }, { status: 400 });
  }

  const { data: divInfo } = await supabaseAdmin.from('divisions').select('name').eq('id', id).single();

  const { error } = await supabaseAdmin.from('divisions').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    userId: user.id, userName: user.full_name, userEmail: user.email,
    action: 'DELETE', entityType: 'DIVISION', entityId: id,
    details: { deleted_name: divInfo?.name },
    ipAddress: getClientIp(request.headers),
  });

  return NextResponse.json({ success: true });
}
