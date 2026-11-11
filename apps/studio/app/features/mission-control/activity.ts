import { listEventPage, listEvents, type EventPosition } from '@senderos/core';
import { parseStudioPath } from './navigation';

type Overview = { attempts: { id: string; runId: string }[]; runs: { id: string; goalId: string }[] };
export type ActivityPage = { older: string | null; newer: string | null; historical: boolean; notice?: string };

export async function studioEvents(overview: Overview, request?: Request): Promise<{ events: Awaited<ReturnType<typeof listEvents>>; activityPage?: ActivityPage }> {
  // Preserve the existing complete programmatic inspection contract. HTTP loaders
  // always supply a request and use bounded database reads below.
  if (!request) return { events: await listEvents({}) };
  const url = new URL(request.url);
  const route = parseStudioPath(url.pathname);
  const executionContextId = url.searchParams.get('context') || undefined;
  const projectId = url.searchParams.get('project') || route.projectId;
  const scope = JSON.stringify([executionContextId ?? '', projectId ?? '']);
  let cursor: EventPosition | undefined;
  let notice: string | undefined;
  const raw = url.searchParams.get('cursor');
  const direction = url.searchParams.get('history');
  if (route.view === 'events' && raw) {
    try {
      if (raw.length > 2048 || !['older', 'newer'].includes(direction ?? '')) throw new Error();
      const parsed = JSON.parse(raw);
      if (parsed.scope !== scope || typeof parsed.createdAt !== 'string' || !Number.isFinite(Date.parse(parsed.createdAt)) || typeof parsed.id !== 'string' || !parsed.id || parsed.id.length > 200) throw new Error();
      cursor = { createdAt: parsed.createdAt, id: parsed.id };
    } catch { notice = 'This history position is invalid or belongs to another scope. Showing the latest activity.'; }
  }
  const attempt = overview.attempts.find(item => item.id === route.attemptId);
  const run = overview.runs.find(item => item.id === attempt?.runId);
  const goalId = route.goalId ?? run?.goalId;
  const entityIds = [route.attemptId, route.agentId, route.transitionId, route.senderoId, route.senderoNodeId, route.senderoEdgeId].filter((id): id is string => !!id);
  const page = await listEventPage({ executionContextId, projectId, limit: 50,
    ...(route.view === 'events' ? { cursor, direction: cursor && direction === 'newer' ? 'newer' : 'older' } : goalId || entityIds.length ? { goalId, ...(entityIds.length ? { entityIds } : {}) } : {}),
  });
  const encode = (position: EventPosition | null) => position ? JSON.stringify({ ...position, scope }) : null;
  return { events: page.events, ...(route.view === 'events' ? { activityPage: { older: encode(page.older), newer: encode(page.newer), historical: !!cursor, notice } } : {}) };
}
