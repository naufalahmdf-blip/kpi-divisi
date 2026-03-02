import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const search = searchParams.get('search') || '';
  const actionFilter = searchParams.get('action') || '';
  const entityFilter = searchParams.get('entity_type') || '';
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from('activity_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`user_name.ilike.%${search}%,user_email.ilike.%${search}%`);
  }

  if (actionFilter) {
    query = query.eq('action', actionFilter);
  }

  if (entityFilter) {
    query = query.eq('entity_type', entityFilter);
  }

  const { data: logs, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    logs: logs || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
