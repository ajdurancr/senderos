import { DurableLink as Link } from '../../../components/durable-link';
import { StatusBadge } from '../../../components/status-badge';
import { relativeTime } from '../model';
import { useLocation } from 'react-router';
import { historyPage } from '../history-page';
import { attemptPath } from '../navigation';
import type { MissionControlData } from '../server';

type Attempt = MissionControlData['attempts'][number];
export type ActivationView = { id: string; goalId: string; nodeId: string; status: string; revision: number; latestRunId: string | null; parentActivationId: string | null; scopesJson: string; createdAt: string; reason?: string | null };
export function activationRecords(data: MissionControlData): ActivationView[] {
  return 'activations' in data && Array.isArray(data.activations) ? data.activations as ActivationView[] : [];
}
export function executionPhase(attempt: Attempt) {
  if (['succeeded', 'failed', 'canceled', 'paused'].includes(attempt.status)) return attempt.status;
  if (attempt.startedAt && attempt.externalSessionId) return 'started';
  if (attempt.status === 'running' && !attempt.externalSessionId) return 'running (session unverified)';
  if (attempt.ownerId) return 'claimed';
  return 'reserved';
}
function stringList(value?: string): string[] {
  try { const values = JSON.parse(value ?? '[]'); return Array.isArray(values) ? values.filter(item => typeof item === 'string') : []; }
  catch { return []; }
}
/** Durable settlement takes precedence over older host observations and leases. */
function recoveryGuidance(attempt: Attempt, expired: boolean, completionPending: boolean): { title: string; text: string } | null {
  if (['succeeded', 'failed', 'canceled'].includes(attempt.status)) return attempt.recoveryOutcome ? {
    title: 'Attempt settled', text: 'The recovery observation is retained history. Use the current goal plan for any further work; do not reclaim this terminal attempt.',
  } : null;
  if (completionPending) return {
    title: 'Review completion requirements', text: 'The reported completion is waiting for evidence or review. Check the attempt requirements and current goal plan before retrying; do not launch another worker for this completion.',
  };
  if (attempt.cancellationRequestedAt) return {
    title: 'Wait for host acknowledgement', text: 'Cancellation was requested. The owning host must stop actual work and report canceled. This request does not confirm that the worker stopped. If the host is unavailable, inspect the existing session before recovery.',
  };
  if (attempt.recoveryOutcome === 'unknown') return {
    title: 'Keep recovery blocked', text: 'The host could not establish the session state. Inspect the existing worker on its host before recording another observation. Do not launch a replacement or infer termination.',
  };
  if (attempt.recoveryOutcome === 'missing') return {
    title: 'Independently confirm the process stopped', text: 'A missing session is not stop confirmation. Only after independently confirming termination may an authorized operator explicitly abandon with a reason. Abandonment does not kill a process.',
  };
  if (attempt.recoveryOutcome === 'active') return expired ? {
    title: 'Reclaim ownership and continue the existing session', text: 'The recorded observation was active. Inspect it again before recovery, then reclaim ownership through the host contract. Reclaim rotates the fence; do not launch another worker.',
  } : {
    title: 'Continue the existing session', text: 'The recorded observation was active. The owning host should continue or heartbeat that worker under its current claim. Do not launch a replacement based on an older observation.',
  };
  return expired ? { title: 'Inspect the existing session', text: 'Ask the owning host to inspect its worker and record active, finished, missing, or unknown through attempt reconcile before choosing a recovery action.' } : null;
}
export function HostExecutionRecords({ data, attempt }: { data: MissionControlData; attempt: Attempt }) {
  const host = data.hosts?.find(item => item.id === attempt.ownerId);
  const preflight = 'preflight' in attempt && attempt.preflight && typeof attempt.preflight === 'object' ? attempt.preflight as Record<string, unknown> : undefined;
  const recovery = data.events.filter(event => event.entityId === attempt.id && ['attempt.reconciled', 'attempt.abandoned'].includes(event.eventType)).at(-1);
  let completionPending = false;
  try { completionPending = attempt.status === 'paused' && JSON.parse(attempt.statusSnapshotJson).completionRequested === true; } catch { /* Malformed metadata cannot establish completion. */ }
  const expired = !completionPending && !!attempt.leaseExpiresAt && Date.parse(attempt.leaseExpiresAt) < (data.asOf ?? Date.now()) && !['succeeded', 'failed', 'canceled'].includes(attempt.status);
  const guidance = recoveryGuidance(attempt, expired, completionPending);
  const recoveryDetails = typeof attempt.recoveryDetails?.details === 'string' ? attempt.recoveryDetails.details : typeof attempt.recoveryDetails?.reason === 'string' ? attempt.recoveryDetails.reason : undefined;
  return <section className="host-records" aria-label="Host and session records">
    <details className="inspector-disclosure">
    <summary>Host and session records</summary>
    <p>Host-reported records. Senderos does not launch or inspect external processes.</p>
    <dl className="property-list">
      <div><dt>Execution phase</dt><dd>{executionPhase(attempt)}</dd></div>
      <div><dt>Owner</dt><dd>{host?.name ?? attempt.ownerId ?? 'Unclaimed'}</dd></div>
      <div><dt>Host ID</dt><dd className="mono">{attempt.ownerId ?? 'Not assigned'}</dd></div>
      <div><dt>Host context</dt><dd>{data.executionContexts.find(context => context.id === host?.executionContextId)?.name ?? host?.executionContextId ?? 'Not recorded'}</dd></div>
      <div><dt>Harness / tool</dt><dd>{attempt.harness}</dd></div>
      <div><dt>Capabilities</dt><dd>{stringList(host?.capabilitiesJson).join(', ') || 'Not declared'}</dd></div>
      <div><dt>Lease expiry</dt><dd>{attempt.leaseExpiresAt ?? 'No lease'}</dd></div>
      <div><dt>Claimed</dt><dd>{attempt.claimedAt ?? 'Not claimed'}</dd></div>
      <div><dt>Worker session</dt><dd className="mono">{attempt.externalSessionId ?? 'Not started'}</dd></div>
      <div><dt>Parent session</dt><dd className="mono">{attempt.parentSessionId ?? 'Not recorded'}</dd></div>
      <div><dt>Started</dt><dd>{attempt.startedAt ?? 'Not started'}</dd></div>
      <div><dt>Location</dt><dd>{attempt.hostEnvironmentName ?? 'Not recorded'}</dd></div>
      <div><dt>Workspace</dt><dd className="mono">{attempt.workingPath ?? 'Not recorded'}</dd></div>
      <div><dt>Heartbeat</dt><dd>{relativeTime(attempt.heartbeatAt, data.asOf)}</dd></div>
      <div><dt>Cancellation</dt><dd>{attempt.cancellationRequestedAt ?? 'Not requested'}</dd></div>
      <div><dt>Recovery</dt><dd>{attempt.recoveryOutcome ?? 'No observation'}</dd></div>
      <div><dt>Recovery observed</dt><dd>{attempt.recoveryObservedAt ?? 'Not recorded'}</dd></div>
    </dl>
    <section aria-label="Recorded resume guidance">
      <h4>Recorded resume command</h4>
      {attempt.resumeCommand ? <>
        <p>Host-reported text for inspection only. Inspect the host, session, workspace and current ownership before using it. This record does not authorize resuming; check current status, cancellation and recovery guidance first. Senderos does not execute this text.</p>
        <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{attempt.resumeCommand}</pre>
      </> : <p>No resume command recorded.</p>}
    </section>
    {preflight ? <details><summary>Recorded preflight</summary><dl className="property-list">{['eligible', 'checkedAt', 'blockers', 'requiredCapabilities', 'declaredCapabilities', 'missingCapabilities', 'declarationOnly'].map(key => key in preflight ? <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1')}</dt><dd>{Array.isArray(preflight[key]) ? (preflight[key] as unknown[]).filter(value => typeof value === 'string').join(', ') || 'None' : String(preflight[key])}</dd></div> : null)}</dl>{Boolean(preflight.workspace) && typeof preflight.workspace === "object" && <dl className="property-list">{Object.entries(preflight.workspace as Record<string, unknown>).filter(([key]) => ["reference", "workingPath", "path", "available", "verifiedAt"].includes(key)).map(([key, value]) => <div key={key}><dt>Workspace {key}</dt><dd>{String(value ?? "Not recorded")}</dd></div>)}</dl>}</details> : <p>No preflight snapshot recorded for this attempt.</p>}
    {(recoveryDetails || recovery) && <p>Recovery observation: {recoveryDetails ?? String((recovery!.payload as Record<string, unknown>).details ?? (recovery!.payload as Record<string, unknown>).reason ?? attempt.recoveryOutcome ?? 'Recorded')}</p>}
    </details>
    {guidance && <section className="inspector-section" aria-label="Recovery next step"><h3>{guidance.title}</h3><p>{guidance.text}</p>{!completionPending && !['succeeded', 'failed', 'canceled'].includes(attempt.status) && <p>Host recovery is an explicit CLI or Core operation. Inspect <code>senderos attempt --help</code> and <code>senderos attempt reconcile --help</code> on the owning host. Keep claim credentials private.</p>}</section>}
    {expired && <p role="status">The lease expired. The host must inspect the session before recovery; expiry does not prove the process stopped.</p>}
  </section>;
}

export function GoalActivations({ data, goalId, attemptId }: { data: MissionControlData; goalId: string; attemptId?: string }) {
  const location = useLocation();
  const goal = data.goals.find(item => item.id === goalId);
  if (!goal) return null;
  const records = activationRecords(data).filter(item => item.goalId === goalId).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const runIds = new Set(data.runs.filter(run => run.goalId === goalId).map(run => run.id));
  const goalAttempts = data.attempts.filter(attempt => runIds.has(attempt.runId));
  const graph = [...(data.historyGraphs ?? []), ...data.senderoGraphs].find(graph => graph.version.id === goal.senderoVersionId);
  const nodes = new Map(graph?.nodes.map(node => [node.id, node]) ?? []);
  const attempts = new Map<string, Attempt>();
  for (const attempt of goalAttempts) {
    if (attempt.attemptNumber >= (attempts.get(attempt.runId)?.attemptNumber ?? -1)) attempts.set(attempt.runId, attempt);
  }
  const decisions = new Map(data.decisions?.find(item => item.goalId === goalId)?.activations.map(item => [item.activationId, item]) ?? []);
  const visits = new Map<string, number>(), nodeCounts = new Map<string, number>();
  for (const record of records) { const visit = (nodeCounts.get(record.nodeId) ?? 0) + 1; nodeCounts.set(record.nodeId, visit); visits.set(record.id, visit); }
  const rows = records.length ? records.map(activation => ({ ...activation, attempt: attempts.get(activation.latestRunId ?? ''), activation })) : goalAttempts.map(attempt => ({ ...attempt, attempt, activation: undefined }));
  // Failed/blocked/waiting activations can still need intervention. Only durable settlement belongs in history.
  const settled = (row: typeof rows[number]) => row.activation ? ['succeeded', 'joined', 'canceled'].includes(row.status) : ['succeeded', 'failed', 'canceled'].includes(row.status);
  const current = rows.filter(row => !settled(row));
  const selected = rows.find(row => row.attempt?.id === attemptId);
  const search = new URLSearchParams(location.search);
  const scope = JSON.stringify([search.get('context') || '', goal.projectId, goalId]);
  const page = historyPage(rows.filter(settled), scope, search.get('visitCursor'), search.get('visitHistory'), search.get('visitHistory') === 'latest' ? undefined : selected?.id);
  const headingId = `visit-history-${goalId}`;
  const linkFor = (pathname: string, cursor?: string | null, direction?: string | null, hash = headingId) => {
    const next = new URLSearchParams(location.search);
    next.delete('visitCursor'); next.delete('visitHistory');
    if (cursor && direction) { next.set('visitCursor', cursor); next.set('visitHistory', direction); }
    else if (direction === 'latest') next.set('visitHistory', 'latest');
    return `${pathname}${next.size ? `?${next}` : ''}#${hash}`;
  };
  const card = (row: typeof rows[number]) => {
    const activation = row.activation, attempt = row.attempt;
    const decision = activation && decisions.get(activation.id);
    const body = activation ? <><strong>{nodes.get(activation.nodeId)?.label ?? activation.nodeId} · visit {visits.get(activation.id)}</strong><StatusBadge value={attempt ? executionPhase(attempt) : activation.status} /><small>Activation {activation.id} · revision {activation.revision}</small><small>Parent {activation.parentActivationId ?? 'entry'}</small><small>Fork generations: {stringList(activation.scopesJson).join(', ') || 'none'}</small>{(decision?.reason ?? activation.reason) && <small>{(decision?.reason ?? activation.reason)!.replaceAll('_', ' ')}</small>}{decision?.nextAction && <small>Next: {decision.nextAction.replaceAll('_', ' ')}</small>}</> : <><strong>{data.agents.find(agent => agent.id === attempt?.agentId)?.name ?? attempt?.agentId}</strong><StatusBadge value={executionPhase(attempt!)} /><small>{attempt?.id}</small></>;
    return attempt ? <Link key={row.id} aria-current={attempt.id === attemptId ? 'true' : undefined} className={attempt.id === attemptId ? 'selected' : ''} to={linkFor(attemptPath(goal.projectId, attempt.id), page.current, page.direction, 'run-detail')}>{body}</Link> : <article key={row.id}>{body}</article>;
  };
  return <section className="inspector-section" aria-label="Activations and branches"><header><h3>Activations and branches</h3><span>{rows.length} {rows.length === 1 ? 'visit' : 'visits'}</span></header>
    {current.length > 0 && <><h4 className="visit-heading">Current visits ({current.length})</h4><p>All unresolved visits remain visible, including failed branches needing intervention.</p><div className="activation-list" aria-label="Current visits">{current.map(card)}</div></>}
    <h4 className="visit-heading" id={headingId} tabIndex={-1}>Settled visit history</h4><p>{page.items.length} on this page · {page.total} settled · newest first</p>
    {page.notice && <p role="status">This visit history position is invalid or belongs to another goal or scope. Showing the latest settled visits.</p>}
    <nav className="activity-pagination" aria-label="Visit history pagination">
      {page.newer && <Link className="button button-secondary" to={linkFor(location.pathname, page.newer, 'newer')}>Newer visits</Link>}
      {page.older && <Link className="button button-secondary" to={linkFor(location.pathname, page.older, 'older')}>Older visits</Link>}
      {page.historical && <Link className="button button-secondary" to={linkFor(location.pathname, null, 'latest')}>Latest visits</Link>}
    </nav>
    {selected && settled(selected) && !page.items.some(row => row.id === selected.id) && <p role="status">The selected attempt is outside this history page. Its recorded details remain available. <Link to={linkFor(location.pathname)}>Show selected visit</Link></p>}
    <div className="activation-list" aria-label="Settled visits">{page.items.map(card)}</div>
    {!rows.length && <p>No activations yet. Start the goal to discover ready work.</p>}
    {rows.length > 0 && !page.total && <p>No settled visits yet.</p>}
  </section>;
}
