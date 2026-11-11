import { expect, test } from 'bun:test';
import { openRuntimeDb } from '../db/client';
import { events } from '../db/schema';
import { createProjectFixture, initHome } from '../test-support/runtime';
import { listEventPage, listEvents, createGoal, activateGoal, dispatchRun } from '../index';

test('pages tied timestamps without duplicates, applies scope before limiting, and leaves full history intact', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const other = await createProjectFixture(home, { name: 'Other project' });
  const db = openRuntimeDb(home);
  const plan = await db.$client.execute('EXPLAIN QUERY PLAN SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT 51');
  expect(JSON.stringify(plan.rows)).toContain('events_created_at_id_idx');
  const createdAt = '2099-01-01T00:00:00.000Z';
  await db.insert(events).values(Array.from({ length: 125 }, (_, i) => ({ id: `page-${String(i).padStart(3, '0')}`, eventType: 'fixture.history', entityType: 'project', entityId: i < 105 ? project.id : other.id, createdAt, payloadJson: '{}' })));
  const first = await listEventPage({ home, projectId: project.id });
  expect(first.events).toHaveLength(50);
  expect(first.events.map(event => event.id)).toEqual(Array.from({ length: 50 }, (_, i) => `page-${String(i + 55).padStart(3, '0')}`));
  expect(first.newer).toBeNull();
  await db.insert(events).values({ id: 'page-new-arrival', eventType: 'fixture.history', entityType: 'project', entityId: project.id, createdAt: '2099-01-02T00:00:00.000Z', payloadJson: '{}' });
  const second = await listEventPage({ home, projectId: project.id, cursor: first.older! });
  expect(second.events.map(event => event.id)).toEqual(Array.from({ length: 50 }, (_, i) => `page-${String(i + 5).padStart(3, '0')}`));
  const back = await listEventPage({ home, projectId: project.id, cursor: second.newer!, direction: 'newer' });
  expect(back.events).toEqual(first.events);
  const last = await listEventPage({ home, projectId: project.id, cursor: second.older! });
  expect(last.events.filter(event => event.eventType === 'fixture.history')).toHaveLength(5);
  expect(last.older).toBeNull();
  expect((await listEvents({ home, entityId: project.id })).filter(event => event.eventType === 'fixture.history')).toHaveLength(106);
  expect((await listEventPage({ home, executionContextId: project.executionContextId, projectId: other.id })).events.filter(event => event.eventType === 'fixture.history')).toHaveLength(20);
  expect((await listEventPage({ home, executionContextId: 'missing', projectId: project.id })).events).toEqual([]);
  expect((await listEventPage({ home, cursor: { createdAt: '1900-01-01', id: 'before-all' } })).events).toEqual([]);
  expect((await listEventPage({ home, projectId: 'missing' })).events).toEqual([]);
  expect((await listEventPage({ home, entityIds: [] })).events).toEqual([]);
  await expect(listEventPage({ home, limit: 0 })).rejects.toThrow(/size/);
  await expect(listEventPage({ home, cursor: { createdAt, id: 'x'.repeat(201) } })).rejects.toThrow(/position/);
  await expect(listEventPage({ home, limit: 101 })).rejects.toThrow(/size/);
  await expect(listEventPage({ home, cursor: { createdAt: 'bad', id: 'x' } })).rejects.toThrow(/position/);
  await expect(listEventPage({ home, cursor: { createdAt, id: '' } })).rejects.toThrow(/position/);
});


test('retains goal, activation, run and attempt observations in bounded scoped entity reads', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Scoped history' });
  await activateGoal(goal.id, home);
  const run = await dispatchRun({ goalId: goal.id }, home);
  const db = openRuntimeDb(home);
  const { activations } = await import('../db/schema');
  const activation = (await db.select().from(activations))[0]!;
  const ids = [goal.id, run.runId, run.attemptId, activation.id];
  await db.insert(events).values(ids.map((entityId, index) => ({ id: `related-${index}`, entityId, entityType: 'fixture', eventType: 'fixture.related', createdAt: '2099-01-01T00:00:00.000Z', payloadJson: '{}' })));
  const filtered = await listEventPage({ home, projectId: project.id, goalId: goal.id });
  expect(filtered.events.filter(event => event.eventType === 'fixture.related').map(event => event.entityId)).toEqual(ids);
  expect((await listEventPage({ home, executionContextId: project.executionContextId })).events.filter(event => event.eventType === 'fixture.related')).toHaveLength(4);
  expect((await listEventPage({ home, entityIds: [run.attemptId] })).events.filter(event => event.eventType === 'fixture.related')).toHaveLength(1);
  expect((await listEventPage({ home, goalId: goal.id, entityIds: ['another'] })).events.filter(event => event.eventType === 'fixture.related')).toHaveLength(4);
  expect((await listEventPage({ home, goalId: 'missing' })).events).toEqual([]);
});


test('upgrades existing history with additive indexes without changing records', async () => {
  const home = await initHome();
  const db = openRuntimeDb(home);
  await db.insert(events).values({ id: 'preserved', eventType: 'fixture.original', entityType: 'project', entityId: 'original', createdAt: '2020-01-01T00:00:00.000Z', payloadJson: '{"details":"Original recovery observation"}' });
  const before = await listEvents({ home });
  // Reconstruct the previous migration's exact schema in this disposable DB.
  await db.$client.executeMultiple('DROP INDEX events_created_at_id_idx; DROP INDEX events_entity_created_at_id_idx; DELETE FROM __drizzle_migrations WHERE created_at = (SELECT max(created_at) FROM __drizzle_migrations)');
  const { migrateRuntimeDb } = await import('../db/migrate');
  await migrateRuntimeDb(home);
  await migrateRuntimeDb(home);
  expect((await listEvents({ home })).sort((a, b) => a.id.localeCompare(b.id))).toEqual(before.sort((a, b) => a.id.localeCompare(b.id)));
  const indexes = await db.$client.execute("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'events_%_idx'");
  expect(indexes.rows.map(row => row.name).sort()).toEqual(['events_created_at_id_idx', 'events_entity_created_at_id_idx']);
});
