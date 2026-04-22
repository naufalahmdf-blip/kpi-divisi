import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
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
    card?: { id?: string; name?: string; due?: string; dueComplete?: boolean };
    old?: { due?: string | null; dueComplete?: boolean };
    listBefore?: { id: string; name: string };
    listAfter?: { id: string; name: string };
  };
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

async function fetchBoardData(boardId: string) {
  const [boardRes, listsRes, cardsRes, membersRes] = await Promise.all([
    fetch(`https://api.trello.com/1/boards/${boardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=name`),
    fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`),
    fetch(`https://api.trello.com/1/boards/${boardId}/cards/all?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=name,due,dueComplete,dateLastActivity,idList,idMembers,closed`),
    fetch(`https://api.trello.com/1/boards/${boardId}/members?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=fullName,username`),
  ]);
  if (!listsRes.ok || !cardsRes.ok) throw new Error(`Gagal fetch board ${boardId}`);

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

  return { doneCards, listMap, boardName: boardInfo.name as string, memberMap };
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

interface OtdDetail {
  card_id: string;
  name: string;
  list: string;
  board: string;
  due: string | null;
  completed: string | null;
  is_on_time: boolean;
  excluded: boolean;
  members: string[];
  admin_note: string | null;
  due_overridden: boolean;
  completed_at_overridden: boolean;
  is_on_time_overridden: boolean;
  original_due: string | null;
  due_changed: boolean;
}

/**
 * Live fetch fallback: tarik langsung dari Trello API saat DB snapshot
 * belum pernah di-sync untuk divisi ini.
 */
async function computeLiveOtd(
  divisionId: string,
  year: number,
  month: number,
  week: number | null
): Promise<{ otd_percentage: number; on_time: number; late: number; total: number; details: OtdDetail[] } | null> {
  if (!TRELLO_API_KEY || !TRELLO_TOKEN) return null;

  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select('trello_board_id')
    .eq('id', divisionId)
    .single();
  if (!division?.trello_board_id) return null;

  const boardIds = division.trello_board_id.split(',').map((id: string) => id.trim()).filter(Boolean);
  if (boardIds.length === 0) return null;

  const boardResults = await Promise.all(boardIds.map(fetchBoardData));
  const allDoneCards: { card: TrelloCard; listName: string; boardName: string; memberMap: Record<string, string> }[] = [];
  for (const { doneCards, listMap, boardName, memberMap } of boardResults) {
    for (const card of doneCards) {
      allDoneCards.push({ card, listName: listMap[card.idList] || 'Unknown', boardName, memberMap });
    }
  }

  let filtered = allDoneCards;
  if (year > 0 && month > 0) {
    const weekRange = week && week >= 1 && week <= 4 ? getWeekDateRange(year, month, week) : null;
    filtered = allDoneCards.filter(({ card }) => {
      const due = new Date(card.due!);
      if (due.getFullYear() !== year || due.getMonth() + 1 !== month) return false;
      if (weekRange && (due < weekRange.start || due > weekRange.end)) return false;
      return true;
    });
  }

  const [firstDoneDates, originalDues] = await Promise.all([
    Promise.all(filtered.map(({ card }) => fetchFirstDoneAt(card.id))),
    Promise.all(filtered.map(({ card }) => fetchOriginalDue(card.id))),
  ]);

  let onTime = 0;
  let late = 0;
  const details: OtdDetail[] = filtered.map(({ card, listName, boardName, memberMap }, idx) => {
    const due = new Date(card.due!);
    const completedTs = firstDoneDates[idx] ?? card.dateLastActivity;
    const act = new Date(completedTs);
    const buffer = new Date(due);
    buffer.setDate(buffer.getDate() + 1);
    const isOnTime = act <= buffer;
    if (isOnTime) onTime++;
    else late++;

    const originalDue = originalDues[idx];
    return {
      card_id: card.id,
      name: card.name,
      list: listName,
      board: boardName,
      due: due.toISOString(),
      completed: act.toISOString(),
      is_on_time: isOnTime,
      excluded: false,
      members: (card.idMembers || []).map((id) => memberMap[id] || id),
      admin_note: null,
      due_overridden: false,
      completed_at_overridden: false,
      is_on_time_overridden: false,
      original_due: originalDue,
      due_changed: !!originalDue,
    };
  });

  const total = onTime + late;
  const otd_percentage = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;
  return { otd_percentage, on_time: onTime, late, total, details };
}

/**
 * GET /api/trello/otd?division_id=xxx&year=2026&month=3[&week=2]
 * Prefer DB snapshot (respects admin override). Fall back ke live Trello
 * kalau divisi belum pernah di-sync (tabel kosong / belum ada).
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const divisionId = searchParams.get('division_id');
  const year = parseInt(searchParams.get('year') || '0');
  const month = parseInt(searchParams.get('month') || '0');
  const weekParam = searchParams.get('week');
  const week = weekParam ? parseInt(weekParam) : null;

  if (!divisionId) {
    return NextResponse.json({ error: 'division_id diperlukan' }, { status: 400 });
  }

  // Cek apakah divisi ini sudah pernah di-sync
  const { count, error: countError } = await supabaseAdmin
    .from('trello_card_snapshots')
    .select('card_id', { count: 'exact', head: true })
    .eq('division_id', divisionId);

  if (countError || count === null || count === 0) {
    // Live fallback
    const live = await computeLiveOtd(divisionId, year, month, week);
    if (!live) {
      return NextResponse.json({
        error: 'Trello belum dikonfigurasi untuk divisi ini',
        otd_percentage: 0, on_time: 0, late: 0, total: 0, details: [],
      }, { status: 404 });
    }
    return NextResponse.json(live);
  }

  // Period scope
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;
  if (year > 0 && month > 0) {
    const weekRange = week && week >= 1 && week <= 4 ? getWeekDateRange(year, month, week) : null;
    periodStart = weekRange ? weekRange.start : new Date(year, month - 1, 1, 0, 0, 0, 0);
    periodEnd = weekRange ? weekRange.end : new Date(year, month, 0, 23, 59, 59, 999);
  }

  let query = supabaseAdmin
    .from('trello_card_snapshots')
    .select('*')
    .eq('division_id', divisionId)
    .eq('deleted_on_trello', false)
    .order('due', { ascending: true });

  if (periodStart && periodEnd) {
    query = query.gte('due', periodStart.toISOString()).lte('due', periodEnd.toISOString());
  }

  const { data: snapshots, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let onTime = 0;
  let late = 0;
  type Snapshot = {
    card_id: string;
    name: string | null;
    list_name: string | null;
    board_name: string | null;
    due: string | null;
    original_due: string | null;
    completed_at: string | null;
    is_on_time: boolean | null;
    excluded: boolean;
    member_names: string[] | null;
    admin_note: string | null;
    due_overridden: boolean;
    completed_at_overridden: boolean;
    is_on_time_overridden: boolean;
  };
  const typedSnapshots = (snapshots || []) as Snapshot[];

  const details: OtdDetail[] = typedSnapshots.map((s) => {
    const isOnTime = s.is_on_time;
    if (!s.excluded) {
      if (isOnTime === true) onTime++;
      else if (isOnTime === false) late++;
    }
    // "due_changed" kalau original_due ada dan berbeda dari due terkini
    const dueChanged = !!s.original_due && !!s.due && new Date(s.original_due).getTime() !== new Date(s.due).getTime();
    return {
      card_id: s.card_id,
      name: s.name || '',
      list: s.list_name || '',
      board: s.board_name || '',
      due: s.due,
      completed: s.completed_at,
      is_on_time: isOnTime ?? false,
      excluded: s.excluded,
      members: s.member_names || [],
      admin_note: s.admin_note,
      due_overridden: s.due_overridden,
      completed_at_overridden: s.completed_at_overridden,
      is_on_time_overridden: s.is_on_time_overridden,
      original_due: dueChanged ? s.original_due : null,
      due_changed: dueChanged,
    };
  });

  const total = onTime + late;
  const otd_percentage = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;

  return NextResponse.json({
    otd_percentage,
    on_time: onTime,
    late,
    total,
    details,
  });
}
