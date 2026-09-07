import { asc, eq, and } from 'drizzle-orm';

import { openRuntimeDb } from '../db/client';
import { events } from '../db/schema';
import { now, randomId } from './ids';

export async function emitEvent(
  db: ReturnType<typeof openRuntimeDb>,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: unknown,
) {
  await db.insert(events).values({ id: randomId('event'), eventType, entityType, entityId, payloadJson: JSON.stringify(payload ?? {}), createdAt: now() });
}

export async function listEvents(input: {
  entityType?: string;
  entityId?: string;
  home?: string;
}) {
  const db = openRuntimeDb(input.home);
  const query = db.select().from(events);
  const rows = await (input.entityType && input.entityId
    ? query.where(and(eq(events.entityType, input.entityType), eq(events.entityId, input.entityId))).orderBy(asc(events.createdAt))
    : input.entityType
      ? query.where(eq(events.entityType, input.entityType)).orderBy(asc(events.createdAt))
      : input.entityId
        ? query.where(eq(events.entityId, input.entityId)).orderBy(asc(events.createdAt))
        : query.orderBy(asc(events.createdAt)));
  return rows.map((row: any) => ({
    id: row.id,
    eventType: row.eventType,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: JSON.parse(row.payloadJson),
    createdAt: row.createdAt,
  }));
}
