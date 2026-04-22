import { supabaseAdmin } from '@/lib/supabase';
import { getWeekDateRange } from '@/lib/utils';

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
  const listsRes = await fetch(
    `https://api.trello.com/1/boards/${boardId}/lists?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`
  );
  if (!listsRes.ok) return { doneCards: [] as TrelloCard[], listMap: {} as Record<string, string> };
  const lists: { id: string; name: string }[] = await listsRes.json();
  const listMap: Record<string, string> = {};
  lists.forEach((l) => (listMap[l.id] = l.name));

  const cardsRes = await fetch(
    `https://api.trello.com/1/boards/${boardId}/cards/all?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&fields=name,due,dueComplete,dateLastActivity,idList,closed`
  );
  if (!cardsRes.ok) return { doneCards: [] as TrelloCard[], listMap };
  const allCards: TrelloCard[] = await cardsRes.json();

  const doneCards = allCards.filter((c) => {
    const listName = (listMap[c.idList] || '').toLowerCase();
    if (listName.includes('archive')) return false;
    return c.due && (c.dueComplete || listName.includes('done'));
  });

  return { doneCards, listMap };
}

/**
 * Fetch OTD percentage from Trello for a division in a given month.
 * If `week` (1-4) is provided, scope cards to that week's date range
 * (week 1 = 1-7, week 2 = 8-14, week 3 = 15-21, week 4 = 22-end).
 * Returns null if Trello is not configured or fetch fails.
 */
export async function fetchTrelloOtd(
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
    const boardResults = await Promise.all(boardIds.map(fetchBoardData));

    const allDoneCards: { card: TrelloCard; listName: string }[] = [];
    for (const { doneCards, listMap } of boardResults) {
      for (const card of doneCards) {
        allDoneCards.push({ card, listName: listMap[card.idList] || 'Unknown' });
      }
    }

    // Filter by month/year, and optionally narrow to a single week
    const weekRange = week && week >= 1 && week <= 4 ? getWeekDateRange(year, month, week) : null;
    const filtered = allDoneCards.filter(({ card }) => {
      const due = new Date(card.due!);
      if (due.getFullYear() !== year || due.getMonth() + 1 !== month) return false;
      if (weekRange && (due < weekRange.start || due > weekRange.end)) return false;
      return true;
    });

    let onTime = 0;
    let late = 0;
    for (const { card } of filtered) {
      const due = new Date(card.due!);
      const act = new Date(card.dateLastActivity);
      const buffer = new Date(due);
      buffer.setDate(buffer.getDate() + 1);
      if (act <= buffer) onTime++;
      else late++;
    }

    const total = onTime + late;
    const otdPercentage = total > 0 ? Math.round((onTime / total) * 10000) / 100 : 0;

    return { otdPercentage, onTime, late, total };
  } catch {
    return null;
  }
}
