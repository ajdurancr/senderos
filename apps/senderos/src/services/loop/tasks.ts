import type { FeatureRecord, LoopPhase, TaskRecord, TaskStatus } from "../../domain/types";
import { openConfiguredCommandDb } from "../../db/client";
import { mapTaskRow } from "../../db/mappers";
import { now, randomId } from "../../utils/common";
import { emitEvent } from "../events";
import { getWorkspace } from "./queries";
import { defaultInstruction } from "./instructions";
export function updateTaskStatus(taskId: string, status: TaskStatus, result?: unknown, home?: string) {
  const db = openConfiguredCommandDb(home);
  db.prepare("update tasks set status=?, result_json=?, updated_at=? where id=?").run(status, JSON.stringify(result ?? {}), now(), taskId);
  emitEvent(db, "task.updated", "task", taskId, { status, result });
  db.close();
}
export function ensurePhaseTask(feature: FeatureRecord, phase: LoopPhase, home?: string) {
  const db = openConfiguredCommandDb(home);
  const existing = mapTaskRow(db.query("select * from tasks where feature_id=? and phase=? order by created_at desc limit 1").get(feature.id, phase));
  if (existing) { db.close();
  return existing; }
  const workspace = feature.currentWorkspaceId ? getWorkspace(feature.currentWorkspaceId, home) as any : null;
  const task: TaskRecord = { id: randomId("task"), featureId: feature.id, name: `${phase} task for ${feature.title}`, phase, status: phase === "contract" ? "ready" : "pending", instructionJson: JSON.stringify(defaultInstruction(feature, phase, workspace?.root_path)), resultJson: "{}", createdAt: now(), updatedAt: now() };
  db.prepare("insert into tasks (id,feature_id,name,phase,status,instruction_json,result_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?)").run(task.id, task.featureId, task.name, task.phase, task.status, task.instructionJson, task.resultJson, task.createdAt, task.updatedAt);
  emitEvent(db, "task.created", "task", task.id, { featureId: feature.id, phase });
  db.close();
  return task;
}
