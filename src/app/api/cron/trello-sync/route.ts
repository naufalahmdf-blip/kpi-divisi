import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/activity-log';
import { syncAllDivisionsTrello } from '@/lib/trello-sync';

/**
 * GET/POST /api/cron/trello-sync
 * Authorization: Bearer <CRON_SECRET>
 *
 * Endpoint cron eksternal (cronjob.org dsb.) — sync SEMUA divisi yang
 * punya trello_board_id ke snapshot DB. Override admin tetap dijaga.
 *
 * Env: CRON_SECRET  (wajib)
 */
export const maxDuration = 300; // 5 menit, biar cukup untuk banyak divisi/card

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET belum dikonfigurasi di server' }, { status: 500 });
  }

  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const started = Date.now();
  const results = await syncAllDivisionsTrello();
  const durationMs = Date.now() - started;

  const successes = results.filter((r) => r.ok);
  const failures = results.filter((r) => !r.ok);
  const totalSynced = successes.reduce((sum, r) => sum + (r.ok ? r.synced : 0), 0);
  const totalOrphaned = successes.reduce((sum, r) => sum + (r.ok ? r.orphaned : 0), 0);

  await logActivity({
    userId: null,
    userName: 'cron',
    userEmail: 'cron@system',
    action: 'SYNC',
    entityType: 'TRELLO_SNAPSHOT',
    entityId: null,
    details: {
      via: 'cron',
      divisions_total: results.length,
      divisions_success: successes.length,
      divisions_failed: failures.length,
      total_synced: totalSynced,
      total_orphaned: totalOrphaned,
      duration_ms: durationMs,
      failures: failures.map((f) => (f.ok ? null : { division_id: f.divisionId, error: f.error })).filter(Boolean),
    },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
  });

  return NextResponse.json({
    success: true,
    divisions_total: results.length,
    divisions_success: successes.length,
    divisions_failed: failures.length,
    total_synced: totalSynced,
    total_orphaned: totalOrphaned,
    duration_ms: durationMs,
    results,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
