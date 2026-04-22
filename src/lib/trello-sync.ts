import { supabaseAdmin } from '@/lib/supabase';

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
    old?: { dueComplete?: boolean; due?: string | null };
    card?: { dueComplete?: boolean; due?: string };
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

async function fetchOriginalDue(cardId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.trello.com/1/cards/${cardId}/actions?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&filter=updateCard:due&limit=50`
    );
    if (!res.ok) return null;
    const actions: TrelloAction[] = await res.json();
    if (actions.length === 0) return null;
    const oldest = actions[actions.length - 1];
    if (oldest?.data?.old?.due) return oldest.data.old.due;
    if (actions.length >= 2) return oldest?.data?.card?.due ?? null;
    return null;
  } catch {
    return null;
  }
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

export type DivisionSyncResult =
  | { ok: true; divisionId: string; synced: number; orphaned: number }
  | { ok: false; divisionId: string; error: string };

/**
 * Sync semua done card dari Trello untuk 1 divisi ke snapshot DB.
 * Override admin (flag *_overridden=true) tidak akan ditimpa. Card yang hilang
 * dari Trello ditandai deleted_on_trello=true.
 */
export async function syncDivisionTrello(divisionId: string): Promise<DivisionSyncResult> {
  if (!TRELLO_API_KEY || !TRELLO_TOKEN) {
    return { ok: false, divisionId, error: 'Trello API key/token belum dikonfigurasi' };
  }

  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select('id, trello_board_id')
    .eq('id', divisionId)
    .single();

  if (!division?.trello_board_id) {
    return { ok: false, divisionId, error: 'Trello board belum dikonfigurasi' };
  }

  const boardIds = division.trello_board_id.split(',').map((s: string) => s.trim()).filter(Boolean);
  if (boardIds.length === 0) {
    return { ok: false, divisionId, error: 'Board ID kosong' };
  }

  try {
    const boardResults = await Promise.all(boardIds.map(fetchBoardData));

    const allDoneCards: { card: TrelloCard; listName: string; boardName: string; boardId: string; memberMap: Record<string, string> }[] = [];
    for (const { doneCards, listMap, boardName, memberMap, boardId } of boardResults) {
      for (const card of doneCards) {
        allDoneCards.push({ card, listName: listMap[card.idList] || 'Unknown', boardName, boardId, memberMap });
      }
    }

    const [firstDoneDates, originalDues] = await Promise.all([
      Promise.all(allDoneCards.map(({ card }) => fetchFirstDoneAt(card.id))),
      Promise.all(allDoneCards.map(({ card }) => fetchOriginalDue(card.id))),
    ]);

    const currentCardIds = allDoneCards.map(({ card }) => card.id);
    const { data: existingSnapshots } = await supabaseAdmin
      .from('trello_card_snapshots')
      .select('*')
      .eq('division_id', divisionId);

    const existingMap = new Map<string, typeof existingSnapshots extends (infer T)[] | null ? T : never>();
    (existingSnapshots || []).forEach((s) => existingMap.set(s.card_id, s));

    const upserts = allDoneCards.map(({ card, listName, boardName, boardId, memberMap }, idx) => {
      const existing = existingMap.get(card.id);
      const firstDone = firstDoneDates[idx] ?? card.dateLastActivity;

      // Semua field harus hadir di payload. Supabase bulk-upsert fill NULL
      // untuk field yang missing — itu akan violate NOT NULL constraint untuk
      // card baru yang belum punya row existing.
      const due = existing?.due_overridden ? existing.due : card.due;
      const completedAt = existing?.completed_at_overridden ? existing.completed_at : firstDone;
      const isOnTime = existing?.is_on_time_overridden
        ? existing.is_on_time
        : computeIsOnTime(due, completedAt);

      return {
        card_id: card.id,
        division_id: divisionId,
        board_id: boardId,
        board_name: boardName,
        list_name: listName,
        name: card.name,
        member_ids: card.idMembers || [],
        member_names: (card.idMembers || []).map((id) => memberMap[id] || id),
        original_due: originalDues[idx],
        due,
        completed_at: completedAt,
        is_on_time: isOnTime,
        due_overridden: existing?.due_overridden ?? false,
        completed_at_overridden: existing?.completed_at_overridden ?? false,
        is_on_time_overridden: existing?.is_on_time_overridden ?? false,
        excluded: existing?.excluded ?? false,
        admin_note: existing?.admin_note ?? null,
        deleted_on_trello: false,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    if (upserts.length > 0) {
      const { error: upsertErr } = await supabaseAdmin
        .from('trello_card_snapshots')
        .upsert(upserts, { onConflict: 'card_id' });
      if (upsertErr) {
        console.error('[trello-sync] upsert error:', upsertErr);
        return { ok: false, divisionId, error: `DB upsert error: ${upsertErr.message}` };
      }
    }

    const orphanedIds = (existingSnapshots || [])
      .filter((s) => !currentCardIds.includes(s.card_id))
      .map((s) => s.card_id);
    if (orphanedIds.length > 0) {
      await supabaseAdmin
        .from('trello_card_snapshots')
        .update({ deleted_on_trello: true, synced_at: new Date().toISOString() })
        .in('card_id', orphanedIds);
    }

    return { ok: true, divisionId, synced: upserts.length, orphaned: orphanedIds.length };
  } catch (err) {
    console.error('[trello-sync] exception:', err);
    const message = err instanceof Error ? err.message : 'Gagal sync Trello';
    return { ok: false, divisionId, error: message };
  }
}

/**
 * Sync SEMUA divisi yang punya trello_board_id. Dipakai oleh cron endpoint.
 * Sequential (bukan parallel) biar tidak hajar rate limit Trello.
 */
export async function syncAllDivisionsTrello(): Promise<DivisionSyncResult[]> {
  const { data: divisions } = await supabaseAdmin
    .from('divisions')
    .select('id, trello_board_id')
    .not('trello_board_id', 'is', null);

  const results: DivisionSyncResult[] = [];
  for (const div of divisions || []) {
    if (!div.trello_board_id) continue;
    const result = await syncDivisionTrello(div.id);
    results.push(result);
  }
  return results;
}
