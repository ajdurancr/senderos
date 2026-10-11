import { eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../../db/client";
import { goals } from "../../db/schema";
import { requireGoal } from "../../lifecycle/scope";
import { requireLifecycle } from "../../lifecycle/errors";
import { cursor } from "../../lifecycle/state";
import { route } from "../../lifecycle/route";
import { emitEvent } from "../../shared/events";
import { now } from "../../shared/ids";
import { getGoal } from "./get";
export async function activateGoal(id: string, home?: string) {
  return atomic(home, async () => {
    const goal = await requireGoal(id, home);
    requireLifecycle(!["completed", "canceled"].includes(goal.status), "TERMINAL_GOAL", "Create a new goal instead of reactivating terminal work");
    await route(goal.senderoVersionId, home);
    await cursor(id, home);
    if (goal.status !== "active") {
      await openRuntimeDb(home).update(goals).set({ status: "active", updatedAt: now() }).where(eq(goals.id, id));
      await emitEvent(openRuntimeDb(home), "goal.activated", "goal", id, {});
    }
    return getGoal(id, home);
  });
}
