import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { logActivity, getClientIp } from '@/lib/activity-log';
import { syncDivisionTrello } from '@/lib/trello-sync';

/**
 * POST /api/admin/trello/sync
 * Body: { division_id: string }
 *
 * Admin-only. Sync 1 divisi dari Trello ke snapshot DB. Dipanggil oleh tombol
 * Refresh di modal OTD admin.
 */
export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let divisionId: string;
  try {
    const body = await request.json();
    divisionId = body.division_id;
    if (!divisionId) return NextResponse.json({ error: 'division_id diperlukan' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const result = await syncDivisionTrello(divisionId);
  if (!result.ok) {
    // Log ke server console biar mudah debug di terminal dev
    console.error('[trello-sync] failed:', { divisionId, error: result.error });
    const status = result.error.includes('belum dikonfigurasi') ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  await logActivity({
    userId: user.id, userName: user.full_name, userEmail: user.email,
    action: 'SYNC', entityType: 'TRELLO_SNAPSHOT', entityId: divisionId,
    details: { division_id: divisionId, synced: result.synced, orphaned: result.orphaned },
    ipAddress: getClientIp(request.headers),
  });

  return NextResponse.json({
    success: true,
    synced: result.synced,
    orphaned: result.orphaned,
  });
}
