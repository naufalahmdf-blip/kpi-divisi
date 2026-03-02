import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity, getClientIp } from '@/lib/activity-log';

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const divisionId = searchParams.get('division_id');

  let query = supabaseAdmin
    .from('kpi_templates')
    .select('*, divisions(id, name)')
    .order('sort_order');

  if (divisionId) {
    query = query.eq('division_id', divisionId);
  }

  const { data: templates } = await query;

  return NextResponse.json({ templates: templates || [] });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { division_id, category, kpi_name, weight, target, unit, formula_type, sort_order } = body;

    const { data, error } = await supabaseAdmin
      .from('kpi_templates')
      .insert({ division_id, category, kpi_name, weight, target, unit, formula_type, sort_order: sort_order || 0 })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      userId: user.id, userName: user.full_name, userEmail: user.email,
      action: 'CREATE', entityType: 'KPI_TEMPLATE', entityId: data.id,
      details: { kpi_name, category, division_id, weight, target, unit },
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({ template: data }, { status: 201 });
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
    const { id, ...updateData } = body;

    if (!id) return NextResponse.json({ error: 'Template ID diperlukan' }, { status: 400 });

    const { data: oldTemplate } = await supabaseAdmin
      .from('kpi_templates')
      .select('kpi_name, category, weight, target, unit, formula_type')
      .eq('id', id).single();

    const { error } = await supabaseAdmin
      .from('kpi_templates')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await logActivity({
      userId: user.id, userName: user.full_name, userEmail: user.email,
      action: 'UPDATE', entityType: 'KPI_TEMPLATE', entityId: id,
      details: { template_name: oldTemplate?.kpi_name, changes: updateData },
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

  if (!id) return NextResponse.json({ error: 'Template ID diperlukan' }, { status: 400 });

  const { data: tplInfo } = await supabaseAdmin
    .from('kpi_templates').select('kpi_name, category').eq('id', id).single();

  const { error } = await supabaseAdmin.from('kpi_templates').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logActivity({
    userId: user.id, userName: user.full_name, userEmail: user.email,
    action: 'DELETE', entityType: 'KPI_TEMPLATE', entityId: id,
    details: { deleted_name: tplInfo?.kpi_name, category: tplInfo?.category },
    ipAddress: getClientIp(request.headers),
  });

  return NextResponse.json({ success: true });
}
