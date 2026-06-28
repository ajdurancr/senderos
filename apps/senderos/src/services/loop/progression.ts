import type { FeatureRecord } from "../../domain/types";
import { nextPhase } from "../../domain/constants";
import { openLocalDb } from "../../db/client";
import { now } from "../../utils/common";
import { emitEvent } from "../events";
import { dispatchForPhase } from "./dispatch";
import { ensurePhaseTask, updateTaskStatus } from "./tasks";
import { listTasks } from "./queries";
export function startLoopForFeature(feature: FeatureRecord, home?: string) {
  const phase = feature.loopPhase === "idle" ? "contract" : feature.loopPhase;
  return dispatchForPhase(feature, phase, home);
}
export function tickLoopForFeature(feature: FeatureRecord, home?: string) {
  const currentPhase = feature.loopPhase === "idle" ? "contract" : feature.loopPhase;
  const tasks = listTasks(feature.id, home) as any[];
  const currentTask = tasks.find((task) => task.phase === currentPhase && task.status === "running") ?? tasks.find((task) => task.phase === currentPhase);
  if (currentTask && currentTask.status !== "completed") updateTaskStatus(currentTask.id, "completed", { completedAt: now() }, home);
  if (feature.currentRunId) {
    const db = openLocalDb(home);
    db.prepare("update runs set status='completed', result_json=?, updated_at=? where id=?").run(JSON.stringify({ phase: currentPhase, completedAt: now() }), now(), feature.currentRunId);
    db.close();
  }
  const next = nextPhase(currentPhase);
  if (next === "done") {
    const db = openLocalDb(home);
    db.prepare("update features set loop_phase=?, status=?, updated_at=? where id=?").run("done", "completed", now(), feature.id);
    if (feature.currentWorkspaceId) db.prepare("update workspaces set status=?, updated_at=? where id=?").run("released", now(), feature.currentWorkspaceId);
    if (feature.currentRunId) {
      const session = db.query("select * from sessions where run_id=? order by created_at desc limit 1").get(feature.currentRunId) as any;
      if (session) db.prepare("update sessions set status='completed', updated_at=? where id=?").run(now(), session.id);
    }
    emitEvent(db, "feature.completed", "feature", feature.id, {});
    db.close();
    return { feature, run: null, task: null };
  }
  ensurePhaseTask(feature, next, home);
  return dispatchForPhase(feature, next, home);
}
