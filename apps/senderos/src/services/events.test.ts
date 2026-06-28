import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { migrate } from '../db/schema';
import { emitEvent } from './events';

describe('emitEvent', () => {
  test('writes an event record', () => {
    const db = new Database(':memory:');
    migrate(db);
    emitEvent(db, 'feature.created', 'feature', 'feature-1', { ok: true });
    expect(db.query('select event_type, payload_json from events').get()).toEqual({ event_type: 'feature.created', payload_json: '{"ok":true}' });
    db.close();
  });
});
