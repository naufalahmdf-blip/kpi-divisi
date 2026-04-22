import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity, getClientIp } from '@/lib/activity-log';

function computeIsOnTime(due: string | null, completedAt: string | null): boolean | null {
  if (!due || !completedAt) return null;
  const d = new Date(due);
  const a = new Date(completedAt);
  const buffer = new Date(d);
  buffer.setDate(buffer.getDate() + 1);
  return a <= buffer;
}

/**
 * PATCH /api/admin/trello/cards/[cardId]
 * Body (semua opsional — hanya field yang dikirim yang diupdate):
 *   {
 *     due?: string | null,
 *     completed_at?: string | null,
 *     is_on_time?: boolean | null,   // kalau null → reset override, pakai computed
 *     excluded?: boolean,
 *     admin_note?: string | null,
 *     reset?: ('due' | 'completed_at' | 'is_on_time')[]  // reset override flag tsb
 *   }
 *
 * Admin edit otomatis set flag *_overridden=true untuk field yang diubah,
 * supaya sync berikutnya dari Trello tidak menimpa override ini.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { cardId } = await params;
  if (!cardId) return NextResponse.json({ error: 'cardId diperlukan' }, { status: 400 });

  let body: {
    due?: string | null;
    completed_at?: string | null;
    is_on_time?: boolean | null;
    excluded?: boolean;
    admin_note?: string | null;
    reset?: ('due' | 'completed_at' | 'is_on_time')[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Ambil snapshot existing
  const { data: existing } = await supabaseAdmin
    .from('trello_card_snapshots')
    .select('*')
    .eq('card_id', cardId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Snapshot card tidak ditemukan. Sync dulu dari Trello.' }, { status: 404 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const resetFields = body.reset || [];

  if (resetFields.includes('due')) {
    update.due_overridden = false;
  } else if (body.due !== undefined) {
    update.due = body.due;
    update.due_overridden = true;
  }

  if (resetFields.includes('completed_at')) {
    update.completed_at_overridden = false;
  } else if (body.completed_at !== undefined) {
    update.completed_at = body.completed_at;
    update.completed_at_overridden = true;
  }

  if (resetFields.includes('is_on_time')) {
    update.is_on_time_overridden = false;
    // Recompute dari due & completed_at hasil akhir
    const finalDue = (update.due ?? existing.due) as string | null;
    const finalCompleted = (update.completed_at ?? existing.completed_at) as string | null;
    update.is_on_time = computeIsOnTime(finalDue, finalCompleted);
  } else if (body.is_on_time !== undefined) {
    update.is_on_time = body.is_on_time;
    update.is_on_time_overridden = body.is_on_time !== null;
  } else if (update.due !== undefined || update.completed_at !== undefined) {
    // Kalau due/completed_at diubah tapi is_on_time tidak ditentukan,
    // recompute kecuali admin sudah override is_on_time sebelumnya
    if (!existing.is_on_time_overridden) {
      const finalDue = (update.due ?? existing.due) as string | null;
      const finalCompleted = (update.completed_at ?? existing.completed_at) as string | null;
      update.is_on_time = computeIsOnTime(finalDue, finalCompleted);
    }
  }

  if (body.excluded !== undefined) update.excluded = body.excluded;
  if (body.admin_note !== undefined) update.admin_note = body.admin_note;

  const { error } = await supabaseAdmin
    .from('trello_card_snapshots')
    .update(update)
    .eq('card_id', cardId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    userId: user.id, userName: user.full_name, userEmail: user.email,
    action: 'UPDATE', entityType: 'TRELLO_SNAPSHOT', entityId: cardId,
    details: { card_id: cardId, changes: body },
    ipAddress: getClientIp(request.headers),
  });

  return NextResponse.json({ success: true });
}
