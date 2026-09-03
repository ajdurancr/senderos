import type { Database } from 'bun:sqlite';

import { openRuntimeDb } from '../db/client';
import { now, randomId } from './ids';

export function emitEvent(
  db: Database,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: unknown,
) {
  db.prepare(
    'insert into events (id,event_type,entity_type,entity_id,payload_json,created_at) values (?,?,?,?,?,?)',
  ).run(
    randomId('event'),
    eventType,
    entityType,
    entityId,
    JSON.stringify(payload ?? {}),
    now(),
  );
}

export function listEvents(input: {
  entityType?: string;
  entityId?: string;
  home?: string;
}) {
  const db = openRuntimeDb(input.home);
  const where: string[] = [];
  const values: string[] = [];
  if (input.entityType) {
    where.push('entity_type=?');
    values.push(input.entityType);
  }
  if (input.entityId) {
    where.push('entity_id=?');
    values.push(input.entityId);
  }
  const rows = db
    .query(
      `select * from events${where.length ? ` where ${where.join(' and ')}` : ''} order by created_at asc`,
    )
    .all(...values);
  db.close();
  return rows.map((row: any) => ({
    id: row.id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
  }));
}
