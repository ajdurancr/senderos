import { DurableLink as Link } from '../../../components/durable-link';
import type { MissionControlData } from '../server';
import { attemptPath, canvasEntityPath } from '../navigation';

/** Direct persisted edges only: never infer a retry from ordering or walk a cycle. */
export function RetryLineage({ data, attempt, surface }: {
 data: MissionControlData;
 attempt: MissionControlData['attempts'][number];
 surface: 'runs' | 'canvas';
}) {
 const runsById = new Map(data.runs.map(item => [item.id, item]));
 const run = runsById.get(attempt.runId);
 const goal = data.goals.find(item => item.id === run?.goalId);
 if (!run || !goal) return null;
 const related = data.attempts.filter(item => {
  if (item.id === attempt.id) return false;
  const other = runsById.get(item.runId);
  return other?.goalId === goal.id && (run.activationId
   ? other.activationId === run.activationId
   : !other.activationId && item.agentId === attempt.agentId && item.transitionId === attempt.transitionId);
 });
 const previous = related.find(item => item.id === attempt.retryFromAttemptId);
 const retries = related.filter(item => item.retryFromAttemptId === attempt.id)
  .sort((a, b) => a.attemptNumber - b.attemptNumber || a.id.localeCompare(b.id));
 if (!attempt.retryFromAttemptId && !retries.length) return null;
 const path = (id: string) => surface === 'runs'
  ? `${attemptPath(goal.projectId, id)}#run-detail`
  : canvasEntityPath({ projectId: goal.projectId, goalId: goal.id, attemptId: id });
 return <section className="retry-lineage" aria-label="Attempt history">
  <h3>Attempt history</h3>
  <p>Viewing attempt {attempt.attemptNumber}. Evidence and host records below belong to this attempt.</p>
  <nav aria-label="Retry navigation">
   {previous && <Link className="button button-secondary" to={path(previous.id)}>Previous attempt {previous.attemptNumber} · {previous.status}</Link>}
   {retries.map(item => <Link key={item.id} className="button button-secondary" to={path(item.id)}>Retry attempt {item.attemptNumber} · {item.status}</Link>)}
  </nav>
  {attempt.retryFromAttemptId && !previous && <p>Previous attempt is unavailable in this execution scope.</p>}
 </section>;
}
