import { afterAll, expect, test } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@libsql/client';
const root = resolve(process.env.SENDEROS_TEST_RUNTIME_ROOT ?? resolve(import.meta.dirname, '../../../../../.tmp/test-runtime'), `activity-${crypto.randomUUID()}`);
mkdirSync(root, { recursive: true });
process.env.SENDEROS_DATABASE_URL = `file:${resolve(root, 'activity.db')}`;
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('bounds actual Studio activity loads before scope filtering and handles invalid positions safely', async () => {
  const { missionControlData } = await import('./server');
  const { createSenderos, registerExecutionContext } = await import('@senderos/core');
  await missionControlData();
  await registerExecutionContext({ id: 'activity-context', name: 'Activity context' });
  const core = createSenderos({ executionContextId: 'activity-context' });
  const project = await core.commands.projects.create({ name: 'Activity fixture' });
  const other = await core.commands.projects.create({ name: 'Other activity fixture' });
  const db = createClient({ url: process.env.SENDEROS_DATABASE_URL! });
  try {
    await db.batch(Array.from({ length: 125 }, (_, i) => ({ sql: 'INSERT INTO events (id,event_type,entity_type,entity_id,payload_json,created_at) VALUES (?,?,?,?,?,?)', args: [`activity-${String(i).padStart(3, '0')}`, 'fixture.activity', 'project', i < 105 ? project.id : other.id, JSON.stringify({ label: `Recorded event ${i}` }), '2099-01-01T00:00:00.000Z'] })), 'write');
    const request = (query = '') => new Request(`http://studio.local/events?project=${project.id}${query}`);
    const latest = await missionControlData(request());
    expect(latest.events).toHaveLength(50);
    expect(latest.events.every(event => event.entityId === project.id)).toBe(true);
    expect(latest.events.at(-1)?.id).toBe('activity-104');
    const older = await missionControlData(request(`&history=older&cursor=${encodeURIComponent(latest.activityPage!.older!)}`));
    expect(older.events).toHaveLength(50);
    expect(older.events.at(-1)?.id).toBe('activity-054');
    const newer = await missionControlData(request(`&history=newer&cursor=${encodeURIComponent(older.activityPage!.newer!)}`));
    expect(newer.events).toEqual(latest.events);
    for (const bad of ['not-json', '{}', JSON.stringify({ id: 'x', createdAt: 'bad' }), latest.activityPage!.older!.replace(project.id, other.id)]) {
      const reset = await missionControlData(request(`&history=older&cursor=${encodeURIComponent(bad)}`));
      expect(reset.activityPage?.notice).toContain('invalid');
      expect(reset.events).toEqual(latest.events);
    }
    const empty = await missionControlData(new Request('http://studio.local/events?project=missing'));
    expect(empty.events).toEqual([]);
    // A non-activity HTTP loader is bounded too; the programmatic legacy read is complete.
    expect((await missionControlData(new Request('http://studio.local/now'))).events).toHaveLength(50);
    expect((await missionControlData()).events.length).toBeGreaterThan(125);

  } finally { db.close(); }
});
