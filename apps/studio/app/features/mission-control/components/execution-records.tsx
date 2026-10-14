import { DurableLink as Link } from '../../../components/durable-link';
import { StatusBadge } from '../../../components/status-badge';
import { goalExecution, relativeTime } from '../model';
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
export function HostExecutionRecords({ data, attempt }: { data: MissionControlData; attempt: Attempt }) {
  const host = data.hosts?.find(item => item.id === attempt.ownerId);
  const preflight = 'preflight' in attempt && attempt.preflight && typeof attempt.preflight === 'object' ? attempt.preflight as Record<string, unknown> : undefined;
  const recovery = data.events.filter(event => event.entityId === attempt.id && ['attempt.reconciled', 'attempt.abandoned'].includes(event.eventType)).at(-1);
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
    {preflight ? <details><summary>Recorded preflight</summary><dl className="property-list">{['eligible', 'checkedAt', 'blockers', 'requiredCapabilities', 'declaredCapabilities', 'missingCapabilities', 'declarationOnly'].map(key => key in preflight ? <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1')}</dt><dd>{Array.isArray(preflight[key]) ? (preflight[key] as unknown[]).filter(value => typeof value === 'string').join(', ') || 'None' : String(preflight[key])}</dd></div> : null)}</dl>{Boolean(preflight.workspace) && typeof preflight.workspace === "object" && <dl className="property-list">{Object.entries(preflight.workspace as Record<string, unknown>).filter(([key]) => ["reference", "workingPath", "path", "available", "verifiedAt"].includes(key)).map(([key, value]) => <div key={key}><dt>Workspace {key}</dt><dd>{String(value ?? "Not recorded")}</dd></div>)}</dl>}</details> : <p>No preflight snapshot recorded for this attempt.</p>}
    {recovery && <p>Recovery observation: {String((recovery.payload as Record<string, unknown>).details ?? (recovery.payload as Record<string, unknown>).reason ?? attempt.recoveryOutcome ?? 'Recorded')}</p>}
    </details>
    {attempt.leaseExpiresAt && Date.parse(attempt.leaseExpiresAt) < (data.asOf ?? Date.now()) && !['succeeded', 'failed', 'canceled'].includes(attempt.status) && <p role="status">The lease expired. The host must inspect the session before recovery; expiry does not prove the process stopped.</p>}
  </section>;
}

export function GoalActivations({ data, goalId, attemptId }: { data: MissionControlData; goalId: string; attemptId?: string }) {
  const goal = data.goals.find(item => item.id === goalId);
  if (!goal) return null;
  const records = activationRecords(data).filter(item => item.goalId === goalId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const execution = goalExecution(data, goalId);
  return <section className="inspector-section"><header><h3>Activations and branches</h3><span>{records.length || execution.runs.length} {(records.length || execution.runs.length) === 1 ? "visit" : "visits"}</span></header><div className="activation-list">
    {records.map((activation, index) => {
      const graph = [...(data.historyGraphs ?? []), ...data.senderoGraphs].find(graph => graph.version.id === goal.senderoVersionId);
      const node = graph?.nodes.find(node => node.id === activation.nodeId);
      const attempt = data.attempts.filter(item => item.runId === activation.latestRunId).at(-1);
      const visit = records.slice(0, index + 1).filter(item => item.nodeId === activation.nodeId).length;
      const decision = data.decisions?.find(item => item.goalId === goalId)?.activations.find(item => item.activationId === activation.id);
      const body = <><strong>{node?.label ?? activation.nodeId} · visit {visit}</strong><StatusBadge value={attempt ? executionPhase(attempt) : activation.status} /><small>Activation {activation.id} · revision {activation.revision}</small><small>Parent {activation.parentActivationId ?? 'entry'}</small><small>Fork generations: {stringList(activation.scopesJson).join(', ') || 'none'}</small>{(decision?.reason ?? activation.reason) && <small>{(decision?.reason ?? activation.reason)!.replaceAll('_', ' ')}</small>}{decision?.nextAction && <small>Next: {decision.nextAction.replaceAll('_', ' ')}</small>}</>;
      return attempt ? <Link key={activation.id} className={attempt.id === attemptId ? 'selected' : ''} to={attemptPath(goal.projectId, attempt.id)}>{body}</Link> : <article key={activation.id}>{body}</article>;
    })}
    {!records.length && execution.attempts.map(attempt => <Link key={attempt.id} className={attempt.id === attemptId ? 'selected' : ''} to={attemptPath(goal.projectId, attempt.id)}><strong>{data.agents.find(agent => agent.id === attempt.agentId)?.name ?? attempt.agentId}</strong><StatusBadge value={executionPhase(attempt)} /><small>{attempt.id}</small></Link>)}
    {!records.length && !execution.attempts.length && <p>No activations yet. Start the goal to discover ready work.</p>}
  </div></section>;
}
