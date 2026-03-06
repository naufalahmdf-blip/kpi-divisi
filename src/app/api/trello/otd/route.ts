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
  closed: boolean;
}

const TRELLO_API_KEY = process.env.TRELLO_API_KEY || '';
const TRELLO_TOKEN = process.env.TRELLO_TOKEN || '';

async function fetchBoardData(boardId: string) {
  // Fetch lists
  const listsRes = await fetch(
    `https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  );
  if (!listsRes.ok) throw new Error(`Gagal mengambil data list dari board ${boardId}`);
  const lists: { id: string; name: string }[] = await listsRes.json();
  const listMap: Record<string, string> = {};
  lists.forEach((l) => (listMap[l.id] = l.name));

  // Fetch all cards (including archived)
  const cardsRes = await fetch(
    `https://api.trello.com/1/boards/${boardId}/cards/all?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=name,due,dueComplete,dateLastActivity,idList,closed`
  );
  if (!cardsRes.ok) throw new Error(`Gagal mengambil data card dari board ${boardId}`);
  const allCards: TrelloCard[] = await cardsRes.json();

  // Filter: cards with due date that are "done"
  const doneCards = allCards.filter(
    (c) => c.due && (c.dueComplete || (listMap[c.idList] || '').toLowerCase().includes('done'))
  );

  return { doneCards, listMap };
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

    // Merge all done cards with their list maps
    const allDoneCards: { card: TrelloCard; listName: string }[] = [];
    for (const { doneCards, listMap } of boardResults) {
      for (const card of doneCards) {
        allDoneCards.push({ card, listName: listMap[card.idList] || 'Unknown' });
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

    // Compute OTD
    let onTime = 0;
    let late = 0;

    const details = filtered.map(({ card, listName }) => {
      const due = new Date(card.due!);
      const act = new Date(card.dateLastActivity);
      const buffer = new Date(due);
      buffer.setDate(buffer.getDate() + 1);
      const isOnTime = act <= buffer;

      if (isOnTime) onTime++;
      else late++;

      return {
        name: card.name,
        list: listName,
        due: due.toISOString(),
        completed: act.toISOString(),
        is_on_time: isOnTime,
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
