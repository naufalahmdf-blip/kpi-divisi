import { supabaseAdmin } from '@/lib/supabase';
import { getWeekDateRange } from '@/lib/utils';

const TRELLO_API_KEY = process.env.TRELLO_API_KEY || '';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || '';

interface TrelloCard {
  id: string;
  name: string;
  due: string | null;
  dueComplete: boolean;
  dateLastActivity: string;
  idList: string;
  closed: boolean;
}

interface UpdateCardAction {
  date: string;
  data: {
    old?: { dueComplete?: boolean };
    card?: { dueComplete?: boolean };
    listBefore?: { id: string; name: string };
    listAfter?: { id: string; name: string };
  };
}

async function fetchBoardDone(boardId: string) {
  const listsRes = await fetch(
    `https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  );
  if (!listsRes.ok) return { doneCards: [] as TrelloCard[] };
  const lists: { id: string; name: string }[] = await listsRes.json();
  const listMap: Record<string, string> = {};
  lists.forEach((l) => (listMap[l.id] = l.name));

  const cardsRes = await fetch(
    `https://api.trello.com/1/boards/${boardId}/cards/all?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=name,due,dueComplete,dateLastActivity,idList,closed`
  );
  if (!cardsRes.ok) return { doneCards: [] as TrelloCard[] };
  const allCards: TrelloCard[] = await cardsRes.json();

  const doneCards = allCards.filter((c) => {
    const listName = (listMap[c.idList] || '').toLowerCase();
    if (listName.includes('archive')) return false;
    return c.due && (c.dueComplete || listName.includes('done'));
  });
  return { doneCards };
}

async function fetchFirstDoneAt(cardId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.trello.com/1/cards/${cardId}/actions?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&filter=updateCard&limit=100`
    );
    if (!res.ok) return null;
    const actions: UpdateCardAction[] = await res.json();
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

/**
 * Fallback: fetch OTD langsung dari Trello API (tidak pakai DB snapshot).
 * Dipakai saat tabel snapshot belum ada atau belum pernah di-sync.
 */
async function fetchTrelloOtdLive(
  divisionId: string,
  year: number,
  month: number,
  week?: number | null
): Promise<{ otdPercentage: number; onTime: number; late: number; total: number } | null> {
  if (!TRELLO_API_KEY || !TRELLO_TOKEN) return null;

  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select('trello_board_id')
    .eq('id', divisionId)
    .single();

  if (!division?.trello_board_id) return null;

  const boardIds = division.trello_board_id.split(',').map((id: string) => id.trim()).filter(Boolean);
  if (boardIds.length === 0) return null;

  try {
    const boardResults = await Promise.all(boardIds.map(fetchBoardDone));
    const allDoneCards: TrelloCard[] = [];
    for (const { doneCards } of boardResults) {
      allDoneCards.push(...doneCards);
    }

    const weekRange = week && week >= 1 && week <= 4 ? getWeekDateRange(year, month, week) : null;
    const filtered = allDoneCards.filter((card) => {
      const due = new Date(card.due!);
      if (due.getFullYear() !== year || due.getMonth() + 1 !== month) return false;
      if (weekRange && (due < weekRange.start || due > weekRange.end)) return false;
      return true;
    });

    const firstDoneDates = await Promise.all(filtered.map((c) => fetchFirstDoneAt(c.id)));
    let onTime = 0;
    let late = 0;
    filtered.forEach((card, idx) => {
      const due = new Date(card.due!);
      const act = new Date(firstDoneDates[idx] ?? card.dateLastActivity);
      const buffer = new Date(due);
      buffer.setDate(buffer.getDate() + 1);
      if (act <= buffer) onTime++;
      else late++;
    });
    const total = onTime + late;
    const otdPercentage = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;
    return { otdPercentage, onTime, late, total };
  } catch {
    return null;
  }
}

/**
 * Hitung OTD. Prefer DB snapshot (respect override admin). Fall back ke live
 * Trello kalau tabel snapshot belum dibuat, atau divisi ini belum pernah di-sync.
 *   1. Query trello_card_snapshots untuk division_id
 *   2. Kalau ada snapshot (minimal 1 row) → pakai DB sebagai sumber kebenaran
 *   3. Kalau tabel missing (error) atau divisi belum pernah sync (empty) → live fetch
 */
export async function fetchTrelloOtd(
  divisionId: string,
  year: number,
  month: number,
  week?: number | null
): Promise<{ otdPercentage: number; onTime: number; late: number; total: number } | null> {
  // Cek apakah divisi ini sudah pernah di-sync (ada minimal 1 snapshot)
  const { count, error: countError } = await supabaseAdmin
    .from('trello_card_snapshots')
    .select('card_id', { count: 'exact', head: true })
    .eq('division_id', divisionId);

  if (countError || count === null || count === 0) {
    // Belum pernah sync atau tabel belum ada → live fetch
    return fetchTrelloOtdLive(divisionId, year, month, week);
  }

  // Sudah ada snapshot → pakai DB (respects admin override)
  const weekRange = week && week >= 1 && week <= 4 ? getWeekDateRange(year, month, week) : null;
  const periodStart = weekRange ? weekRange.start : new Date(year, month - 1, 1, 0, 0, 0, 0);
  const periodEnd = weekRange ? weekRange.end : new Date(year, month, 0, 23, 59, 59, 999);

  const { data: snapshots, error } = await supabaseAdmin
    .from('trello_card_snapshots')
    .select('is_on_time, due, excluded, deleted_on_trello')
    .eq('division_id', divisionId)
    .eq('excluded', false)
    .eq('deleted_on_trello', false)
    .gte('due', periodStart.toISOString())
    .lte('due', periodEnd.toISOString());

  if (error) return fetchTrelloOtdLive(divisionId, year, month, week);

  let onTime = 0;
  let late = 0;
  for (const s of snapshots || []) {
    if (s.is_on_time === true) onTime++;
    else if (s.is_on_time === false) late++;
  }
  const total = onTime + late;
  const otdPercentage = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;
  return { otdPercentage, onTime, late, total };
}
