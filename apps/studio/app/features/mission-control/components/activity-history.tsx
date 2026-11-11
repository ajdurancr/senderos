import { useLocation } from 'react-router';
import { DurableLink as Link } from '../../../components/durable-link';
import { eventLabel, parseAttemptSnapshot, relativeTime } from '../model';
import type { MissionControlData } from '../server';
import { Icon } from './icons';

export function EventsView({ data }: { data: MissionControlData }) {
  const location = useLocation();
  const page = data.activityPage;
  const destination = (cursor?: string | null, direction?: string) => {
    const search = new URLSearchParams(location.search);
    search.delete('cursor'); search.delete('history');
    if (cursor && direction) { search.set('cursor', cursor); search.set('history', direction); }
    return `${location.pathname}${search.size ? `?${search}` : ''}#activity-history`;
  };
  return <div className="standard-view">
    <header className="view-header"><div><span>Append-only history</span><h1>Activity &amp; events</h1><p>The durable explanation of who changed what, when, and against which orchestration entity.</p></div></header>
    <div className="events-layout"><section aria-labelledby="activity-history">
      <div className="activity-page-header"><h2 id="activity-history" tabIndex={-1}>{page?.historical ? 'Activity history' : 'Latest activity'}</h2><p>{data.events.length} events on this page · newest first</p></div>
      {page?.notice && <p role="status">{page.notice}</p>}
      <nav className="activity-pagination" aria-label="Activity history pagination">
        {page?.newer ? <Link className="button button-secondary" to={destination(page.newer, 'newer')}>Newer events</Link> : <span>At latest activity</span>}
        {page?.older && <Link className="button button-secondary" to={destination(page.older, 'older')}>Older events</Link>}
        {page?.historical && <Link to={destination()}>Latest activity</Link>}
      </nav>
      <ol className="event-stream" role="list" aria-label="Activity events">{[...data.events].reverse().map(event => <li key={event.id}><article data-event-id={event.id}>
        <i aria-hidden="true" /><time dateTime={event.createdAt} title={event.createdAt}>{relativeTime(event.createdAt, data.asOf)}</time>
        <div><strong>{eventLabel(event.eventType)}</strong><span>{event.entityType} · {event.entityId}</span></div>
        <details><summary>Event details</summary><dl><dt>Recorded at</dt><dd>{event.createdAt}</dd><dt>Event ID</dt><dd>{event.id}</dd></dl><pre>{JSON.stringify(event.payload, null, 2)}</pre></details>
      </article></li>)}</ol>
      {!data.events.length && <div className="empty-state"><Icon name="clock" /><h2>{page?.historical ? 'No events at this history position' : 'No events in this scope'}</h2><p>{page?.historical ? 'Activity may have changed. Return to latest activity to continue browsing.' : 'Goal, execution, and configuration changes will appear here as they happen. Try another context or project to see more activity.'}</p></div>}
    </section><aside className="observability-panel"><header><Icon name="pulse" /><span>Execution signals</span></header>
      <p>Current scope totals, across all history.</p>
      <Metric label="Goals" value={data.goals.length} /><Metric label="Runs" value={data.runs.length} /><Metric label="Attempts" value={data.attempts.length} /><Metric label="Retries" value={data.attempts.filter(a => a.retryFromAttemptId).length} /><Metric label="Evidence" value={data.attempts.reduce((sum, a) => sum + (parseAttemptSnapshot(a.statusSnapshotJson).evidence?.length ?? 0), 0)} />
      <div className="signal-bars">{['succeeded', 'running', 'failed', 'queued'].map(status => <div key={status}><span>{status}</span><i style={{ width: `${Math.max(4, data.attempts.filter(a => a.status === status).length / Math.max(1, data.attempts.length) * 100)}%` }} /></div>)}</div>
    </aside></div>
  </div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="metric-row"><span>{label}</span><strong>{value}</strong></div>; }
