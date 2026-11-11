import { expect, test } from 'vitest';
import { runHistoryPage } from './run-history';
const rows = Array.from({ length: 125 }, (_, i) => ({ id: `attempt-${String(i).padStart(3, '0')}`, createdAt: '2026-11-01T00:00:00.000Z' }));
const url = (cursor?: string | null, direction = 'older', project = 'one') => new URL(`http://studio.local/runs?context=team&project=${project}${cursor ? `&runCursor=${encodeURIComponent(cursor)}&runHistory=${direction}` : ''}`);
test('walks tied timestamps in both directions without overlap or missing records', () => {
  const first = runHistoryPage(rows, url());
  expect(first.items.map(row => row.id)).toEqual(rows.slice(-30).reverse().map(row => row.id));
  expect(first.total).toBe(125); expect(first.newer).toBeNull();
  const seen = [...first.items]; let page = first;
  while (page.older) {
    const next = runHistoryPage(rows, url(page.older));
    expect(runHistoryPage(rows, url(next.newer, 'newer')).items).toEqual(page.items);
    seen.push(...next.items); page = next;
  }
  expect(seen).toHaveLength(125); expect(new Set(seen.map(row => row.id)).size).toBe(125);
  expect(rows[0]!.id).toBe('attempt-000');
});
test('places an old deep-linked attempt on its containing page and retains a stable page for selection links', () => {
  const page = runHistoryPage(rows, url(), 'attempt-003');
  expect(page.items.some(row => row.id === 'attempt-003')).toBe(true);
  expect(page.historical).toBe(true);
  expect(runHistoryPage(rows, url(page.current, page.direction!), 'attempt-002').items).toEqual(page.items);
  expect(runHistoryPage(rows, url(), 'attempt-120').historical).toBe(false);
});
test('validates scope, position and direction without widening the supplied records', () => {
  const first = runHistoryPage(rows, url());
  for (const invalid of ['bad', '{}', JSON.stringify({ id: 'x', createdAt: 'bad', scope: '["team","one"]' }), 'x'.repeat(2049)]) {
    const reset = runHistoryPage(rows, url(invalid));
    expect(reset.notice).toContain('invalid'); expect(reset.items).toEqual(first.items);
  }
  expect(runHistoryPage(rows, url(first.older, 'older', 'other')).notice).toContain('another scope');
  expect(runHistoryPage(rows, url(first.older, 'sideways')).notice).toContain('invalid');
  expect(runHistoryPage([], url(first.older)).items).toEqual([]);
  expect(runHistoryPage([], url()).total).toBe(0);
});
test('keeps an existing keyset stable when a newer attempt arrives or the boundary record disappears', () => {
  const first = runHistoryPage(rows, url());
  const expected = runHistoryPage(rows, url(first.older)).items;
  const changed = [...rows.filter(row => row.id !== first.items.at(-1)!.id), { id: 'new', createdAt: '2026-11-02T00:00:00.000Z' }];
  expect(runHistoryPage(changed, url(first.older)).items).toEqual(expected);
});
