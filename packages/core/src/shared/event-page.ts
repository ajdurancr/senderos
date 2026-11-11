import { and, asc, desc, eq, gt, inArray, lt, or } from 'drizzle-orm';
import { openRuntimeDb } from '../db/client';
import { activations, events, goals, projects, runAttempts, runs } from '../db/schema';

export type EventPosition = { createdAt: string; id: string };
/** A bounded read model. Legacy listEvents keeps its complete chronological contract. */
export async function listEventPage(input: {
  home?: string; executionContextId?: string; projectId?: string;
  entityIds?: string[]; goalId?: string; limit?: number; cursor?: EventPosition; direction?: 'older' | 'newer';
}) {
  const limit = input.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Event page size must be between 1 and 100.');
  if (input.cursor && (!Number.isFinite(Date.parse(input.cursor.createdAt)) || !input.cursor.id || input.cursor.id.length > 200)) throw new Error('Invalid event position.');
  const db = openRuntimeDb(input.home);
  const scope = and(input.projectId ? eq(projects.id, input.projectId) : undefined, input.executionContextId ? eq(projects.executionContextId, input.executionContextId) : undefined);
  const projectIds = db.select({ id: projects.id }).from(projects).where(scope);
  const goalIds = db.select({ id: goals.id }).from(goals).where(inArray(goals.projectId, projectIds));
  const runIds = db.select({ id: runs.id }).from(runs).where(inArray(runs.goalId, goalIds));
  const scoped = input.projectId || input.executionContextId ? or(
    inArray(events.entityId, projectIds), inArray(events.entityId, goalIds), inArray(events.entityId, runIds),
    inArray(events.entityId, db.select({ id: runAttempts.id }).from(runAttempts).where(inArray(runAttempts.runId, runIds))),
    inArray(events.entityId, db.select({ id: activations.id }).from(activations).where(inArray(activations.goalId, goalIds))),
  ) : undefined;
  const selectedRunIds = db.select({ id: runs.id }).from(runs).where(eq(runs.goalId, input.goalId ?? ''));
  const goalEvents = input.goalId ? or(eq(events.entityId, input.goalId), inArray(events.entityId, selectedRunIds),
    inArray(events.entityId, db.select({ id: runAttempts.id }).from(runAttempts).where(inArray(runAttempts.runId, selectedRunIds))),
    inArray(events.entityId, db.select({ id: activations.id }).from(activations).where(eq(activations.goalId, input.goalId)))) : undefined;
  const selectedEntities = input.entityIds ? inArray(events.entityId, input.entityIds) : undefined;
  const selection = goalEvents && selectedEntities ? or(goalEvents, selectedEntities) : goalEvents ?? selectedEntities;
  const newer = input.direction === 'newer';
  const compare = newer ? gt : lt;
  const cursor = input.cursor;
  const position = cursor ? or(compare(events.createdAt, cursor.createdAt), and(eq(events.createdAt, cursor.createdAt), compare(events.id, cursor.id))) : undefined;
  const order = newer ? asc : desc;
  const rows = await db.select().from(events).where(and(scoped, selection, position)).orderBy(order(events.createdAt), order(events.id)).limit(limit + 1);
  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  if (!newer) selected.reverse();
  const records = selected.map(({ payloadJson, ...row }) => ({ ...row, payload: JSON.parse(payloadJson) }));
  const positionOf = (row: typeof selected[number] | undefined): EventPosition | null => row ? { createdAt: row.createdAt, id: row.id } : null;
  return { events: records,
    older: (!newer && hasMore) || (newer && !!cursor) ? positionOf(selected[0]) : null,
    newer: (newer && hasMore) || (!newer && !!cursor) ? positionOf(selected.at(-1)) : null,
  };
}
