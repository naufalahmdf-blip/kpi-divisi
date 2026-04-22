import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logActivity, getClientIp } from '@/lib/activity-log';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY || '';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || '';

interface TrelloCard {
  id: string;
  name: string;
  due: string | null;
  dueComplete: boolean;
  dateLastActivity: string;
  idList: string;
  idMembers: string[];
  closed: boolean;
}

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

interface TrelloAction {
  date: string;
  data: {
    old?: { dueComplete?: boolean };
    card?: { dueComplete?: boolean };
    listBefore?: { id: string; name: string };
    listAfter?: { id: string; name: string };
  };
}

async function fetchBoardData(boardId: string) {
  const [boardRes, listsRes, cardsRes, membersRes] = await Promise.all([
    fetch(`https://api.trello.com/1/boards/${boardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=name`),
    fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`),
    fetch(`https://api.trello.com/1/boards/${boardId}/cards/all?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=name,due,dueComplete,dateLastActivity,idList,idMembers,closed`),
    fetch(`https://api.trello.com/1/boards/${boardId}/members?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=fullName,username`),
  ]);
  if (!listsRes.ok || !cardsRes.ok) throw new Error(`Gagal mengambil data board ${boardId}`);

  const boardInfo = boardRes.ok ? await boardRes.json() : { name: boardId };
  const lists: { id: string; name: string }[] = await listsRes.json();
  const listMap: Record<string, string> = {};
  lists.forEach((l) => (listMap[l.id] = l.name));

  const members: TrelloMember[] = membersRes.ok ? await membersRes.json() : [];
  const memberMap: Record<string, string> = {};
  members.forEach((m) => (memberMap[m.id] = m.fullName));

  const allCards: TrelloCard[] = await cardsRes.json();
  const doneCards = allCards.filter((c) => {
    const listName = (listMap[c.idList] || '').toLowerCase();
    if (listName.includes('archive')) return false;
    return c.due && (c.dueComplete || listName.includes('done'));
  });

  return { doneCards, listMap, boardName: boardInfo.name as string, memberMap, boardId };
}

async function fetchFirstDoneAt(cardId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.trello.com/1/cards/${cardId}/actions?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&filter=updateCard&limit=100`
    );
    if (!res.ok) return null;
    const actions: TrelloAction[] = await res.json();
    if (actions.length === 0) return null;
    const oldestFirst = [...actions].reverse();

    const firstComplete = oldestFirst.find(
      (a) => a.data?.old?.dueComplete === false && a.data?.card?.dueComplete === true
    );
    if (firstComplete?.date) return firstComplete.date;

    const firstMoveToDone = oldestFirst.find((a) => {
      const after = a.data?.listAfter?.name?.toLowerCase() ?? '';
      const before = a.data?.listBefore?.name?.toLowerCase() ?? '';
      return after.includes('done') && !before.includes('done');
    });
    return firstMoveToDone?.date ?? null;
  } catch {
    return null;
  }
}

function computeIsOnTime(due: string | null, completedAt: string | null): boolean | null {
  if (!due || !completedAt) return null;
  const d = new Date(due);
  const a = new Date(completedAt);
  const buffer = new Date(d);
  buffer.setDate(buffer.getDate() + 1);
  return a <= buffer;
}

/**
 * POST /api/admin/trello/sync
 * Body: { division_id: string }
 *
 * Tarik semua done card dari board(s) divisi → upsert ke trello_card_snapshots.
 * Field yang sudah di-override admin tidak di-overwrite.
 * Card yang hilang dari Trello ditandai deleted_on_trello=true.
 */
export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!TRELLO_API_KEY || !TRELLO_TOKEN) {
    return NextResponse.json({ error: 'Trello API key/token belum dikonfigurasi' }, { status: 500 });
  }

  let divisionId: string;
  try {
    const body = await request.json();
    divisionId = body.division_id;
    if (!divisionId) return NextResponse.json({ error: 'division_id diperlukan' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select('id, trello_board_id')
    .eq('id', divisionId)
    .single();

  if (!division?.trello_board_id) {
    return NextResponse.json({ error: 'Trello board belum dikonfigurasi untuk divisi ini' }, { status: 404 });
  }

  const boardIds = division.trello_board_id.split(',').map((s: string) => s.trim()).filter(Boolean);
  if (boardIds.length === 0) {
    return NextResponse.json({ error: 'Board ID kosong' }, { status: 400 });
  }

  try {
    const boardResults = await Promise.all(boardIds.map(fetchBoardData));

    // Flatten: semua done card dari semua board divisi
    const allDoneCards: { card: TrelloCard; listName: string; boardName: string; boardId: string; memberMap: Record<string, string> }[] = [];
    for (const { doneCards, listMap, boardName, memberMap, boardId } of boardResults) {
      for (const card of doneCards) {
        allDoneCards.push({ card, listName: listMap[card.idList] || 'Unknown', boardName, boardId, memberMap });
      }
    }

    // Fetch first-done-at untuk semua card secara paralel
    const firstDoneDates = await Promise.all(
      allDoneCards.map(({ card }) => fetchFirstDoneAt(card.id))
    );

    // Ambil snapshot existing untuk cek override flags
    const currentCardIds = allDoneCards.map(({ card }) => card.id);
    const { data: existingSnapshots } = await supabaseAdmin
      .from('trello_card_snapshots')
      .select('*')
      .eq('division_id', divisionId);

    const existingMap = new Map<string, typeof existingSnapshots extends (infer T)[] | null ? T : never>();
    (existingSnapshots || []).forEach((s) => existingMap.set(s.card_id, s));

    // Build upsert payloads
    const upserts = allDoneCards.map(({ card, listName, boardName, boardId, memberMap }, idx) => {
      const existing = existingMap.get(card.id);
      const firstDone = firstDoneDates[idx] ?? card.dateLastActivity;

      const payload: Record<string, unknown> = {
        card_id: card.id,
        division_id: divisionId,
        board_id: boardId,
        board_name: boardName,
        list_name: listName,
        name: card.name,
        member_ids: card.idMembers || [],
        member_names: (card.idMembers || []).map((id) => memberMap[id] || id),
        deleted_on_trello: false,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Due: respect override
      if (existing?.due_overridden) {
        payload.due = existing.due;
      } else {
        payload.due = card.due;
      }

      // Completed_at: respect override
      if (existing?.completed_at_overridden) {
        payload.completed_at = existing.completed_at;
      } else {
        payload.completed_at = firstDone;
      }

      // is_on_time: respect override
      if (existing?.is_on_time_overridden) {
        payload.is_on_time = existing.is_on_time;
      } else {
        payload.is_on_time = computeIsOnTime(
          payload.due as string | null,
          payload.completed_at as string | null
        );
      }

      // Preserve flags & exclude & note
      if (existing) {
        payload.due_overridden = existing.due_overridden;
        payload.completed_at_overridden = existing.completed_at_overridden;
        payload.is_on_time_overridden = existing.is_on_time_overridden;
        payload.excluded = existing.excluded;
        payload.admin_note = existing.admin_note;
      }

      return payload;
    });

    if (upserts.length > 0) {
      const { error: upsertErr } = await supabaseAdmin
        .from('trello_card_snapshots')
        .upsert(upserts, { onConflict: 'card_id' });
      if (upsertErr) {
        return NextResponse.json({ error: upsertErr.message }, { status: 500 });
      }
    }

    // Mark orphaned snapshots (di DB tapi tidak ada di Trello fetch terkini)
    const orphanedIds = (existingSnapshots || [])
      .filter((s) => !currentCardIds.includes(s.card_id))
      .map((s) => s.card_id);
    if (orphanedIds.length > 0) {
      await supabaseAdmin
        .from('trello_card_snapshots')
        .update({ deleted_on_trello: true, synced_at: new Date().toISOString() })
        .in('card_id', orphanedIds);
    }

    await logActivity({
      userId: user.id, userName: user.full_name, userEmail: user.email,
      action: 'SYNC', entityType: 'TRELLO_SNAPSHOT', entityId: divisionId,
      details: { division_id: divisionId, synced: upserts.length, orphaned: orphanedIds.length },
      ipAddress: getClientIp(request.headers),
    });

    return NextResponse.json({
      success: true,
      synced: upserts.length,
      orphaned: orphanedIds.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal sync Trello';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
