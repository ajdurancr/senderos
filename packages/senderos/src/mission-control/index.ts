import {
  activateGoal,
  cancelRun,
  dispatchRun,
  getGoal,
  getRun,
  listAgents,
  listAgentTransitions,
  listGoals,
  listProjects,
  listRunAttempts,
  listRuns,
  plan,
  showRunState,
  status,
} from '../services/runtime';
import { listEvents } from '../services/events';

export function missionControlOverview(home?: string) {
  return {
    status: status(home),
    projects: listProjects(home),
    goals: listGoals(home),
    runs: listRuns(home),
  };
}

export function missionControlGoal(input: { goalId: string; home?: string }) {
  const state = showRunState(input.goalId, input.home);
  return {
    ...state,
    agents: listAgents(input.home),
    transitions: listAgentTransitions(input.home),
    events: listEvents({ home: input.home }),
  };
}

export function missionControlStartGoal(input: {
  goalId: string;
  workingPath?: string;
  home?: string;
}) {
  const goal = activateGoal(input.goalId, input.home);
  if (!goal) throw new Error(`Goal not found: ${input.goalId}`);
  const item = plan({ home: input.home, goalStatuses: ['active'] }).find(
    (candidate) => candidate.goalId === goal.id,
  );
  if (!item) throw new Error(`No dispatchable transition found for goal: ${goal.id}`);
  dispatchRun(
    {
      ...item,
      previousRunId: item.previousRunId ?? undefined,
      workingPath: input.workingPath,
    },
    input.home,
  );
  return missionControlGoal({ goalId: goal.id, home: input.home });
}

export function missionControlStopExecution(input: {
  runId: string;
  home?: string;
}) {
  const run = getRun(input.runId, input.home) as { goal_id: string } | null;
  if (!run) throw new Error(`Run not found: ${input.runId}`);
  cancelRun(input.runId, input.home);
  return missionControlGoal({ goalId: run.goal_id, home: input.home });
}

export function missionControlRetryExecution(input: {
  goalId: string;
  workingPath?: string;
  home?: string;
}) {
  const goal = getGoal(input.goalId, input.home);
  if (!goal) throw new Error(`Goal not found: ${input.goalId}`);
  const item = plan({ home: input.home, goalStatuses: ['failed'] }).find(
    (candidate) => candidate.goalId === goal.id,
  );
  if (!item) throw new Error(`Goal is not retryable: ${goal.id}`);
  dispatchRun(
    {
      ...item,
      previousRunId: item.previousRunId ?? undefined,
      workingPath: input.workingPath,
    },
    input.home,
  );
  return missionControlGoal({ goalId: goal.id, home: input.home });
}
