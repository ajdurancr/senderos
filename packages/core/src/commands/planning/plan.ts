import type { AgentTransitionRecord, GoalStatus } from '../../shared/types';
import { listRunAttempts } from '../attempts/list';
import { listGoals } from '../goals/list';
import { latestRunForGoal } from '../runs/latest-for-goal';
import { listAgentTransitions } from '../transitions/list';
import { openRuntimeDb } from '../../db/client';
import { senderoEdges, senderoNodes } from '../../db/schema';
import { eq } from 'drizzle-orm';
const DEFAULT_GOAL_STATUSES: GoalStatus[] = ['active', 'failed'];
async function nextTransition(
  previousRunId: string | undefined,
  senderoVersionId: string | null,
  home?: string,
): Promise<AgentTransitionRecord | null> {
  const transitions = (await listAgentTransitions(home)).filter(
    (item) => item.status === 'active',
  );
  if (senderoVersionId) {
    const db = openRuntimeDb(home);
    const edges = (await db.select().from(senderoEdges).where(eq(senderoEdges.senderoVersionId, senderoVersionId))).filter((item) => item.status === 'active');
    const nodes = await db.select().from(senderoNodes).where(eq(senderoNodes.senderoVersionId, senderoVersionId));
    const transitionForEdge = (edge: (typeof edges)[number] | undefined) => transitions.find((item) => item.id === edge?.transitionId) ?? null;
    if (!previousRunId) {
      const start = nodes.find((item) => item.kind === 'start');
      const firstNodeId = edges.find((item) => item.sourceNodeId === start?.id)?.targetNodeId;
      return transitionForEdge(edges.find((item) => item.sourceNodeId === firstNodeId && item.transitionId));
    }
    const previous = (await listRunAttempts(previousRunId, home)).at(-1);
    if (!previous) return null;
    if (previous.status === 'failed') return transitions.find((item) => item.id === previous.transitionId) ?? null;
    const previousEdge = edges.find((item) => item.transitionId === previous.transitionId);
    return transitionForEdge(edges.find((item) => item.sourceNodeId === previousEdge?.targetNodeId && item.transitionId));
  }
  if (!previousRunId) return transitions[0] ?? null;
  const previous = (await listRunAttempts(previousRunId, home)).at(-1);
  if (!previous) return transitions[0] ?? null;
  if (previous.status === 'failed')
    return (
      transitions.find((item) => item.id === previous.transitionId) ?? null
    );
  return previous.transitionId
    ? (transitions.find(
        (item) =>
          item.sourceAgentId ===
          (transitions.find(
            (transition) => transition.id === previous.transitionId,
          )?.targetAgentId ?? ''),
      ) ?? null)
    : null;
}
export async function plan(input: { home?: string; goalStatuses?: GoalStatus[] }) {
  const statuses = input.goalStatuses?.length
    ? input.goalStatuses
    : DEFAULT_GOAL_STATUSES;
  const items: Array<{
    goalId: string;
    transitionId: string;
    agentId: string;
    previousRunId: string | null;
  }> = [];
  for (const goal of (await listGoals(input.home)).filter((goal) =>
    statuses.includes(goal.status),
  )) {
    const previous: any = await latestRunForGoal(goal.id, input.home);
    if (
      previous &&
      !['succeeded', 'failed', 'canceled'].includes(previous.status)
    )
      continue;
    const transition = await nextTransition(previous?.id, goal.senderoVersionId, input.home);
    if (transition)
      items.push({
        goalId: goal.id,
        transitionId: transition.id,
        agentId: transition.sourceAgentId,
        previousRunId: previous?.id ?? null,
      });
  }
  return items;
}
