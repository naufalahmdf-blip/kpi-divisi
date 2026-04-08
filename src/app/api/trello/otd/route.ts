import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

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

const TRELLO_API_KEY = process.env.TRELLO_API_KEY || '';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || '';

interface TrelloAction {
  type: string;
  date: string;
  data: {
    card?: { id?: string; name?: string; due?: string };
    old?: { due?: string | null };
  };
}

async function fetchBoardData(boardId: string) {
  // Fetch board info + lists + cards + members in parallel
  const [boardRes, listsRes, cardsRes, membersRes] = await Promise.all([
    fetch(`https://api.trello.com/1/boards/${boardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=name`),
    fetch(`https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`),
    fetch(`https://api.trello.com/1/boards/${boardId}/cards/all?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=name,due,dueComplete,dateLastActivity,idList,idMembers,closed`),
    fetch(`https://api.trello.com/1/boards/${boardId}/members?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=fullName,username`),
  ]);

  if (!listsRes.ok) throw new Error(`Gagal mengambil data list dari board ${boardId}`);
  if (!cardsRes.ok) throw new Error(`Gagal mengambil data card dari board ${boardId}`);

  const boardInfo = boardRes.ok ? await boardRes.json() : { name: boardId };
  const boardName: string = boardInfo.name;

  const lists: { id: string; name: string }[] = await listsRes.json();
  const listMap: Record<string, string> = {};
  lists.forEach((l) => (listMap[l.id] = l.name));

  // Build member lookup map
  const members: TrelloMember[] = membersRes.ok ? await membersRes.json() : [];
  const memberMap: Record<string, string> = {};
  members.forEach((m) => (memberMap[m.id] = m.fullName));

  const allCards: TrelloCard[] = await cardsRes.json();

  // Filter: cards with due date that are "done"
  const doneCards = allCards.filter(
    (c) => c.due && (c.dueComplete || (listMap[c.idList] || '').toLowerCase().includes('done'))
  );

  return { doneCards, listMap, boardName, memberMap };
}

/**
 * Fetch original due date for a card by checking its action history.
 * Returns the first due date that was set, or null if due was never changed.
 */
async function fetchOriginalDue(cardId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.trello.com/1/cards/${cardId}/actions?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&filter=updateCard:due&limit=50`
    );
    if (!res.ok) return null;
    const actions: TrelloAction[] = await res.json();

    // Need at least 1 action to indicate a due date change
    if (actions.length === 0) return null;

    // Actions are newest-first; the oldest action has the first due date change
    const oldest = actions[actions.length - 1];
    // old.due is the due date BEFORE the first change (the true original)
    // If old.due is null, it means due was set for the first time (no prior due to track)
    const originalDue = oldest?.data?.old?.due ?? null;
    return originalDue;
  } catch {
    return null;
  }
}

/**
 * GET /api/trello/otd?division_id=xxx&year=2026&month=3
 * Supports multiple boards per division (comma-separated trello_board_id).
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!TRELLO_API_KEY || !TRELLO_TOKEN) {
    return NextResponse.json({ error: 'Trello API key/token belum dikonfigurasi di server' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const divisionId = searchParams.get('division_id');
  const year = parseInt(searchParams.get('year') || '0');
  const month = parseInt(searchParams.get('month') || '0');

  if (!divisionId) {
    return NextResponse.json({ error: 'division_id diperlukan' }, { status: 400 });
  }

  const { data: division } = await supabaseAdmin
    .from('divisions')
    .select('trello_board_id')
    .eq('id', divisionId)
    .single();

  if (!division?.trello_board_id) {
    return NextResponse.json({ error: 'Trello board belum dikonfigurasi untuk divisi ini' }, { status: 404 });
  }

  // Support multiple boards (comma-separated)
  const boardIds = division.trello_board_id.split(',').map((id: string) => id.trim()).filter(Boolean);

  try {
    // Fetch all boards in parallel
    const boardResults = await Promise.all(boardIds.map(fetchBoardData));

    // Merge all done cards with their list maps, board names, and member maps
    const allDoneCards: { card: TrelloCard; listName: string; boardName: string; memberMap: Record<string, string> }[] = [];
    for (const { doneCards, listMap, boardName, memberMap } of boardResults) {
      for (const card of doneCards) {
        allDoneCards.push({ card, listName: listMap[card.idList] || 'Unknown', boardName, memberMap });
      }
    }

    // Filter by month/year if provided
    let filtered = allDoneCards;
    if (year > 0 && month > 0) {
      filtered = allDoneCards.filter(({ card }) => {
        const due = new Date(card.due!);
        return due.getFullYear() === year && due.getMonth() + 1 === month;
      });
    }

    // Fetch original due dates in parallel for all filtered cards
    const originalDues = await Promise.all(
      filtered.map(({ card }) => fetchOriginalDue(card.id))
    );

    // Compute OTD
    let onTime = 0;
    let late = 0;

    const details = filtered.map(({ card, listName, boardName, memberMap }, idx) => {
      const due = new Date(card.due!);
      const act = new Date(card.dateLastActivity);
      const buffer = new Date(due);
      buffer.setDate(buffer.getDate() + 1);
      const isOnTime = act <= buffer;

      if (isOnTime) onTime++;
      else late++;

      const originalDue = originalDues[idx];

      // Resolve member names from card's idMembers
      const members = (card.idMembers || []).map((id) => memberMap[id] || id);

      return {
        name: card.name,
        list: listName,
        board: boardName,
        due: due.toISOString(),
        completed: act.toISOString(),
        is_on_time: isOnTime,
        original_due: originalDue,
        due_changed: !!originalDue,
        members,
      };
    });

    const total = onTime + late;
    const otdPercentage = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;

    return NextResponse.json({
      otd_percentage: otdPercentage,
      on_time: onTime,
      late,
      total,
      boards: boardIds.length,
      details,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengambil data Trello';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
