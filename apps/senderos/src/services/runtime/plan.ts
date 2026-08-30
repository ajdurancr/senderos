import type { GoalStatus, AgentTransitionRecord } from '../../domain/types';
import { getRun, latestRunForGoal } from './run/dispatch';
import { listAgentTransitions, listRunAttempts } from './agents';
import { listGoals } from './goals';

const DEFAULT_GOAL_STATUSES: GoalStatus[] = ['active', 'failed'];
function nextTransition(
  previousRunId: string | undefined,
  home?: string,
): AgentTransitionRecord | null {
  const transitions = listAgentTransitions(home).filter(
    (item) => item.status === 'active',
  );
  if (!previousRunId) return transitions[0] ?? null;
  const previous = listRunAttempts(previousRunId, home).at(-1);
  if (!previous) return transitions[0] ?? null;
  if (previous.status === 'failed')
    return (
      transitions.find((item) => item.id === previous.transitionId) ?? null
    );
  return previous.transitionId
    ? (transitions.find(
        (item) =>
          item.sourceAgentId ===
          (transitions.find((t) => t.id === previous.transitionId)
            ?.targetAgentId ?? ''),
      ) ?? null)
    : null;
}
export function plan(input: { home?: string; goalStatuses?: GoalStatus[] }) {
  const statuses = input.goalStatuses?.length
    ? input.goalStatuses
    : DEFAULT_GOAL_STATUSES;
  const items: Array<{
    goalId: string;
    transitionId: string;
    agentId: string;
    previousRunId: string | null;
  }> = [];
  for (const goal of listGoals(input.home).filter((goal) =>
    statuses.includes(goal.status),
  )) {
    const previous: any = latestRunForGoal(goal.id, input.home);
    if (
      previous &&
      !['succeeded', 'failed', 'canceled'].includes(previous.status)
    )
      continue;
    const transition = nextTransition(previous?.id, input.home);
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
