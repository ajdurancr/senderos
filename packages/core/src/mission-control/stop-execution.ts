import { getRun } from "../commands/runs/get";
import { cancelRun } from "../commands/runs/cancel";
import { missionControlGoal } from "./goal";

export async function missionControlStopExecution(input: {
  runId: string;
  home?: string;
}) {
  const run = await getRun(input.runId, input.home);
  if (!run) throw new Error(`Run not found: ${input.runId}`);
  await cancelRun(input.runId, input.home);
  return missionControlGoal({ goalId: run.goalId, home: input.home });
}
