import { parseStudioPath } from './navigation';
import { historyPage } from './history-page';

/** Bound presentation only. Planning, attention and exact-attempt facts stay complete. */
export function runHistoryPage<T extends { id: string; createdAt: string }>(attempts: T[], url: URL, selectedId?: string) {
  const projectId = url.searchParams.get('project') || parseStudioPath(url.pathname).projectId;
  const scope = JSON.stringify([url.searchParams.get('context') || '', projectId || '']);
  const page = historyPage(attempts, scope, url.searchParams.get('runCursor'), url.searchParams.get('runHistory'), selectedId);
  return { ...page, notice: page.notice ? 'This run history position is invalid or belongs to another scope. Showing the latest attempts.' : undefined };
}
