import { sql } from 'drizzle-orm';

import { openRuntimeDb } from '../db/client';
import { now, randomId } from './ids';

export async function emitEvent(
  db: ReturnType<typeof openRuntimeDb>,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: unknown,
) {
  await db.run(sql`insert into events (id,event_type,entity_type,entity_id,payload_json,created_at) values (${randomId('event')},${eventType},${entityType},${entityId},${JSON.stringify(payload ?? {})},${now()})`);
}

export async function listEvents(input: {
  entityType?: string;
  entityId?: string;
  home?: string;
}) {
  const db = openRuntimeDb(input.home);
  const rows = await db.all(input.entityType && input.entityId ? sql`select * from events where entity_type=${input.entityType} and entity_id=${input.entityId} order by created_at asc` : input.entityType ? sql`select * from events where entity_type=${input.entityType} order by created_at asc` : input.entityId ? sql`select * from events where entity_id=${input.entityId} order by created_at asc` : sql`select * from events order by created_at asc`);
  return rows.map((row: any) => ({
    id: row.id,
    eventType: row.event_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload_json),
    createdAt: row.created_at,
  }));
}
