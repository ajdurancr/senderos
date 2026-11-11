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
    {preflight ? <details><summary>Recorded preflight</summary><dl className="property-list">{['eligible', 'checkedAt', 'blockers', 'requiredCapabilities', 'declaredCapabilities', 'missingCapabilities', 'declarationOnly'].map(key => key in preflight ? <div key={key}><dt>{key.replace(/([A-Z])/g, ' $1')}</dt><dd>{Array.isArray(preflight[key]) ? (preflight[key] as unknown[]).filter(value => typeof value === 'string').join(', ') || 'None' : String(preflight[key])}</dd></div> : null)}</dl>{Boolean(preflight.workspace) && typeof preflight.workspace === "object" && <dl className="property-list">{Object.entries(preflight.workspace as Record<string, unknown>).filter(([key]) => ["reference", "workingPath", "path", "available", "verifiedAt"].includes(key)).map(([key, value]) => <div key={key}><dt>Workspace {key}</dt><dd>{String(value ?? "Not recorded")}</dd></div>)}</dl>}</details> : <p>No preflight snapshot recorded for this attempt.</p>}
    {(recoveryDetails || recovery) && <p>Recovery observation: {recoveryDetails ?? String((recovery!.payload as Record<string, unknown>).details ?? (recovery!.payload as Record<string, unknown>).reason ?? attempt.recoveryOutcome ?? 'Recorded')}</p>}
    </details>
    {guidance && <section className="inspector-section" aria-label="Recovery next step"><h3>{guidance.title}</h3><p>{guidance.text}</p>{!completionPending && !['succeeded', 'failed', 'canceled'].includes(attempt.status) && <p>Host recovery is an explicit CLI or Core operation. Inspect <code>senderos attempt --help</code> and <code>senderos attempt reconcile --help</code> on the owning host. Keep claim credentials private.</p>}</section>}
    {expired && <p role="status">The lease expired. The host must inspect the session before recovery; expiry does not prove the process stopped.</p>}
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
