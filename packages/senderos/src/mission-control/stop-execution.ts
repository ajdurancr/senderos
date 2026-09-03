import { getRun } from '../commands/runs';
import { cancelRun } from '../commands/runs/execution';
import { missionControlGoal } from './goal';

export function missionControlStopExecution(input: { runId: string; home?: string }) {
  const run = getRun(input.runId, input.home);
  if (!run) throw new Error(`Run not found: ${input.runId}`);
  cancelRun(input.runId, input.home);
  return missionControlGoal({ goalId: run.goal_id, home: input.home });
}
