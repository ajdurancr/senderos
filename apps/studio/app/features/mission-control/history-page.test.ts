import { expect, test } from 'vitest';
import { historyPage } from './history-page';
const rows = Array.from({ length: 65 }, (_, i) => ({ id: `row-${String(i).padStart(3, '0')}`, createdAt: '2026-11-01T00:00:00.000Z' }));
test('keeps goal-specific positions fenced and old selections stable with immutable supplied records', () => {
  const initial = historyPage(rows, 'goal-one', null, null);
  const older = historyPage(rows, 'goal-one', initial.older, 'older');
  expect(older.items).toHaveLength(30);
  expect(historyPage(rows, 'goal-one', older.newer, 'newer').items).toEqual(initial.items);
  expect(historyPage(rows, 'goal-two', initial.older, 'older').items).toEqual(initial.items);
  expect(historyPage(rows, 'goal-two', initial.older, 'older').notice).toContain('another scope');
  const selected = historyPage(rows, 'goal-one', null, null, 'row-001');
  expect(selected.items.map(row => row.id)).toContain('row-001');
  expect(historyPage(rows, 'goal-one', selected.current, selected.direction, 'row-003').items).toEqual(selected.items);
  expect(rows).toHaveLength(65);
});
test('offers recovery from an empty valid position without inventing records', () => {
  const boundary = historyPage(rows, 'goal', null, null).older!;
  const page = historyPage([], 'goal', boundary, 'older');
  expect(page.items).toEqual([]);
  expect(page.historical).toBe(true);
  expect(historyPage(rows, 'goal', 'broken', 'older').notice).toContain('invalid');
});
