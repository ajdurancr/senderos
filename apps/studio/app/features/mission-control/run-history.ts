import { parseStudioPath } from './navigation';

type Position = { id: string; createdAt: string };
const limit = 30;
const compare = (left: Position, right: Position) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id);

/** Bound presentation only. Planning, attention and exact-attempt facts stay complete. */
export function runHistoryPage<T extends Position>(attempts: T[], url: URL, selectedId?: string) {
  const ordered = [...attempts].sort(compare);
  const projectId = url.searchParams.get('project') || parseStudioPath(url.pathname).projectId;
  const scope = JSON.stringify([url.searchParams.get('context') || '', projectId || '']);
  const encode = (row: Position) => JSON.stringify({ id: row.id, createdAt: row.createdAt, scope });
  const raw = url.searchParams.get('runCursor');
  let direction = url.searchParams.get('runHistory');
  let cursor: Position | undefined;
  let notice: string | undefined;
  if (raw) {
    try {
      if (raw.length > 2048 || !['older', 'newer'].includes(direction ?? '')) throw new Error();
      const parsed = JSON.parse(raw);
      if (parsed.scope !== scope || typeof parsed.id !== 'string' || !parsed.id || parsed.id.length > 200 || typeof parsed.createdAt !== 'string' || !Number.isFinite(Date.parse(parsed.createdAt))) throw new Error();
      cursor = { id: parsed.id, createdAt: parsed.createdAt };
    } catch { notice = 'This run history position is invalid or belongs to another scope. Showing the latest attempts.'; }
  }
  let current = cursor ? raw : null;
  let items: T[];
  if (cursor) {
    const matches = ordered.filter(row => direction === 'newer' ? compare(row, cursor!) < 0 : compare(row, cursor!) > 0);
    items = direction === 'newer' ? matches.slice(-limit) : matches.slice(0, limit);
  } else {
    const selectedIndex = !raw && selectedId ? ordered.findIndex(row => row.id === selectedId) : -1;
    const start = selectedIndex >= limit ? Math.floor(selectedIndex / limit) * limit : 0;
    items = ordered.slice(start, start + limit);
    if (start) { current = encode(ordered[start - 1]!); direction = 'older'; }
  }
  const first = items[0], last = items.at(-1);
  return {
    items, total: attempts.length, current, direction: current ? direction : null,
    historical: !!current, notice,
    newer: first && ordered.some(row => compare(row, first) < 0) ? encode(first) : null,
    older: last && ordered.some(row => compare(row, last) > 0) ? encode(last) : null,
  };
}
