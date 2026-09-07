import { describe, expect, test } from 'bun:test';
import { openRuntimeDb } from '../db/client';
import { emitEvent, listEvents } from './events';
import { initHome } from '../test-support/runtime';

describe('emitEvent', () => {
  test('writes an event record', async () => {
    const home = await initHome();
    const db = openRuntimeDb(home);
    await emitEvent(db, 'feature.created', 'feature', 'feature-1', { ok: true });
    await expect(listEvents({ home })).resolves.toEqual(
      expect.arrayContaining([
      expect.objectContaining({
        eventType: 'feature.created',
        entityType: 'feature',
        entityId: 'feature-1',
        payload: { ok: true },
      }),
      ]),
    );
    db.$client.close();
  });
});

test('listEvents filters persisted runtime events', async () => {
  const home = await initHome();
  const db = openRuntimeDb(home);
  await emitEvent(db, 'goal.created', 'goal', 'goal-1', { ok: true });
  expect(await listEvents({ home, entityType: 'goal' })).toHaveLength(1);
  expect((await listEvents({ home, entityId: 'goal-1' }))[0]?.entityId).toBe('goal-1');
  db.$client.close();
});
