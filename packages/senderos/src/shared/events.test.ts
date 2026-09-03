import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { openRuntimeDb } from '../db/client';
import { migrate } from '../db/migrations';
import { emitEvent, listEvents } from './events';
import { initHome } from '../../tests/helpers/runtime';

describe('emitEvent', () => {
  test('writes an event record', () => {
    const db = new Database(':memory:');
    migrate(db);
    emitEvent(db, 'feature.created', 'feature', 'feature-1', { ok: true });
    expect(db.query('select event_type, payload_json from events').get()).toEqual({ event_type: 'feature.created', payload_json: '{"ok":true}' });
    db.close();
  });
});

test('listEvents filters persisted runtime events', () => {
  const home = initHome();
  const db = openRuntimeDb(home);
  emitEvent(db, 'goal.created', 'goal', 'goal-1', { ok: true });
  expect(listEvents({ home, entityType: 'goal' })).toHaveLength(1);
  expect(listEvents({ home, entityId: 'goal-1' })[0]?.entityId).toBe('goal-1');
  db.close();
});
