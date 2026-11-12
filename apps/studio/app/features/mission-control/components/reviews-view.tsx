import { useLocation } from 'react-router';
import { DurableLink as Link } from '../../../components/durable-link';
import { StatusBadge } from '../../../components/status-badge';
import { historyPage } from '../history-page';
import { parseAttemptSnapshot } from '../model';
import { attemptPath } from '../navigation';
import type { MissionControlData } from '../server';
import { Icon } from './icons';
import { ReviewTimestamp } from './review-timestamp';

const filters = [
  { key: '', label: 'All reviews' },
  { key: 'pending', label: 'Pending review' },
  { key: 'approved', label: 'Approved' },
  { key: 'changes_requested', label: 'Changes requested' },
  { key: 'rejected', label: 'Rejected' },
];

/** Bound the review surface only; preserve every attempt and its exact proof. */
export function ReviewsView({ data }: { data: MissionControlData }) {
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const requested = search.get('reviewStatus') || '';
  const validFilter = filters.some(filter => filter.key === requested);
  const selected = validFilter ? requested : '';
  const records = data.attempts.flatMap(attempt => {
    const snapshot = parseAttemptSnapshot(attempt.statusSnapshotJson);
    return snapshot.evidence?.length || snapshot.review ? [{ ...attempt, snapshot }] : [];
  });
  const status = (record: typeof records[number]) => record.snapshot.review?.status ?? 'pending';
  const matching = records.filter(record => !selected || status(record) === selected);
  const scope = JSON.stringify([search.get('context') || '', search.get('project') || '', selected]);
  const page = historyPage(matching, scope, search.get('reviewCursor'), search.get('reviewHistory'));
  const destination = (filter = selected, cursor?: string | null, direction?: string) => {
    const next = new URLSearchParams(location.search);
    next.delete('reviewStatus'); next.delete('reviewCursor'); next.delete('reviewHistory');
    if (filter) next.set('reviewStatus', filter);
    if (cursor && direction) { next.set('reviewCursor', cursor); next.set('reviewHistory', direction); }
    return `${location.pathname}${next.size ? `?${next}` : ''}#review-history`;
  };
  const runs = new Map(data.runs.map(run => [run.id, run]));
  const goals = new Map(data.goals.map(goal => [goal.id, goal]));
  return <div className="standard-view">
    <header className="view-header"><div><span>Quality gate</span><h1>Evidence reviews</h1><p>Make decisions against concrete proof attached to the exact execution that produced it.</p></div></header>
    <nav className="activity-pagination" aria-label="Review status filters">{filters.map(filter =>
      <Link key={filter.key} className={`button ${selected === filter.key ? 'button-primary' : 'button-secondary'}`} aria-current={selected === filter.key ? 'page' : undefined} to={destination(filter.key)}>{filter.label} ({records.filter(record => !filter.key || status(record) === filter.key).length})</Link>
    )}</nav>
    <div className="activity-page-header"><h2 id="review-history" tabIndex={-1}>{page.historical ? 'Review history' : 'Latest reviews'}</h2><p>{page.items.length} on this page · {page.total} matching · {records.length} in this scope · newest attempts first</p></div>
    {!validFilter && <p role="status">This review filter is invalid. Showing all reviews.</p>}
    {page.notice && <p role="status">This review history position is invalid or belongs to another scope or filter. Showing the latest reviews.</p>}
    <nav className="activity-pagination" aria-label="Review history pagination">
      {page.newer ? <Link className="button button-secondary" to={destination(selected, page.newer, 'newer')}>Newer reviews</Link> : <span>{page.historical ? 'No newer reviews on this page' : 'At latest reviews'}</span>}
      {page.older && <Link className="button button-secondary" to={destination(selected, page.older, 'older')}>Older reviews</Link>}
      {page.historical && <Link to={destination()}>Latest reviews</Link>}
    </nav>
    <div className="review-grid">{page.items.map(attempt => {
      const goal = goals.get(runs.get(attempt.runId)?.goalId ?? '');
      return <article key={attempt.id} data-attempt-id={attempt.id}>
        <header><StatusBadge value={status(attempt)} /><ReviewTimestamp snapshot={attempt.snapshot} updatedAt={attempt.updatedAt} asOf={data.asOf} /></header>
        <h2>{attempt.executionObjective}</h2><p>{attempt.snapshot.evidence?.length ?? 0} evidence items · {attempt.harness}</p>
        <Link to={attemptPath(goal?.projectId ?? 'unknown', attempt.id)}>Inspect evidence <Icon name="arrow" /></Link>
      </article>;
    })}{!page.items.length && <div className="empty-state"><Icon name="check" /><h2>{records.length ? 'No reviews match this selection' : 'No evidence to review'}</h2><p>{records.length ? 'Choose another review status or return to the latest reviews. All recorded proof remains available in Runs.' : 'Evidence and review decisions will appear here after an attempt reports its results.'}</p>{records.length > 0 && <Link className="button button-secondary" to={destination('')}>Show all reviews</Link>}<Link className="button button-secondary" to="/runs">View runs</Link></div>}</div>
  </div>;
}
