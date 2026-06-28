import type { FeatureRecord } from "../../domain/types";
import { openConfiguredCommandDb } from "../../db/client";
import { mapFeatureRow } from "../../db/mappers";
import { now, randomId } from "../../utils/common";
import { emitEvent } from "../events";
import { ensurePhaseTask } from "../loop";
export function createFeature(input: { home?: string; title: string; problemStatement?: string; contractText?: string; completionCriteria?: string; id?: string }) {
  const db = openConfiguredCommandDb(input.home);
  const ts = now();
  const id = input.id ?? randomId("feature");
  db.prepare(`insert into features (id,title,problem_statement,contract_text,status,loop_phase,completion_criteria,current_workspace_id,current_run_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?)`).run(id, input.title, input.problemStatement ?? "", input.contractText ?? "", "defined", "idle", input.completionCriteria ?? "", null, null, ts, ts);
  emitEvent(db, "feature.created", "feature", id, { title: input.title });
  db.close();
  const feature = getFeature(id, input.home)!;
  ensurePhaseTask(feature, "contract", input.home);
  return feature;
}
export function listFeatures(home?: string): FeatureRecord[] {
  const db = openConfiguredCommandDb(home); const rows = db.query("select * from features order by created_at asc").all().map(mapFeatureRow) as FeatureRecord[]; db.close();
  return rows; }
export function getFeature(id: string, home?: string): FeatureRecord | null {
  const db = openConfiguredCommandDb(home); const row = mapFeatureRow(db.query("select * from features where id = ?").get(id)); db.close();
  return row; }
export function updateFeature(input: { home?: string; id: string; title?: string; problemStatement?: string; contractText?: string; completionCriteria?: string }) {
  const current = getFeature(input.id, input.home); if (!current) throw new Error(`Feature not found: ${input.id}`);
  const db = openConfiguredCommandDb(input.home);
  db.prepare("update features set title=?, problem_statement=?, contract_text=?, completion_criteria=?, updated_at=? where id=?").run(input.title ?? current.title, input.problemStatement ?? current.problemStatement, input.contractText ?? current.contractText, input.completionCriteria ?? current.completionCriteria, now(), input.id);
  emitEvent(db, "feature.updated", "feature", input.id, input); db.close();
  return getFeature(input.id, input.home);
}
export function approveFeature(id: string, home?: string) {
  const current = getFeature(id, home); if (!current) throw new Error(`Feature not found: ${id}`);
  const db = openConfiguredCommandDb(home); db.prepare("update features set status=?, loop_phase=?, updated_at=? where id=?").run("ready_contract", "contract", now(), id); emitEvent(db, "feature.approved", "feature", id, {}); db.close(); ensurePhaseTask(getFeature(id, home)!, "contract", home);
  return getFeature(id, home);
}
export function cancelFeature(id: string, home?: string) {
  const db = openConfiguredCommandDb(home); db.prepare("update features set status=?, updated_at=? where id=?").run("canceled", now(), id); db.prepare("update tasks set status='canceled', updated_at=? where feature_id=? and status not in ('completed','failed')").run(now(), id); emitEvent(db, "feature.canceled", "feature", id, {}); db.close();
  return getFeature(id, home); }
