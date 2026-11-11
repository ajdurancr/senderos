import { getSenderoGraph, listSenderoVersions, type SenderoGraph } from '@senderos/core';
import { parseStudioPath } from './navigation';

/** HTTP pages need pinned goal definitions, not every past publication. */
export async function studioGraphData(goals: { senderoVersionId: string | null }[], current: SenderoGraph[], request?: Request) {
  const complete = !request;
  const management = complete || parseStudioPath(new URL(request.url).pathname).view === 'senderos';
  const pinned = new Set(goals.map(goal => goal.senderoVersionId));
  const cached = new Map(current.map(graph => [graph.version.id, graph]));
  const historyGraphs: SenderoGraph[] = [];
  const draftGraphs: SenderoGraph[] = [];
  for (const version of await listSenderoVersions()) {
    if (version.status === 'published' ? !complete && !pinned.has(version.id) : version.status !== 'draft' || !management) continue;
    const graph = cached.get(version.id) ?? await getSenderoGraph(version.senderoId, version.version);
    if (!graph) continue;
    if (version.status === 'draft') draftGraphs.push(graph);
    else historyGraphs.push(graph);
  }
  return { historyGraphs, draftGraphs };
}
