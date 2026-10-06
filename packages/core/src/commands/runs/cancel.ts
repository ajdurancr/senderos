import { atomic } from "../../db/client";
import { requireRun } from "../../lifecycle/scope";
import { requireLifecycle } from "../../lifecycle/errors";
import { terminal } from "../../lifecycle/state";
import { cancelGoal } from "../goals/cancel";
import { getRun } from "./get";
export async function cancelRun(id: string, home?: string) {
  return atomic(home, async () => {
    const run = await requireRun(id, home);
    requireLifecycle(!terminal(run.status) || run.status === "canceled", "TERMINAL_RUN", "Finished runs cannot be canceled");
    if (run.status !== "canceled") await cancelGoal(run.goalId, home);
    return getRun(id, home);
  });
}
