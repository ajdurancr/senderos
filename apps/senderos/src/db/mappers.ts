import type { FeatureRecord, TaskRecord } from "../domain/types";
export function mapFeatureRow(row: any): FeatureRecord | null {
  if (!row) return null;
  return { id: row.id, title: row.title, problemStatement: row.problem_statement, contractText: row.contract_text, status: row.status, loopPhase: row.loop_phase, completionCriteria: row.completion_criteria, currentWorkspaceId: row.current_workspace_id, currentRunId: row.current_run_id, createdAt: row.created_at, updatedAt: row.updated_at };
}
export function mapTaskRow(row: any): TaskRecord | null {
  if (!row) return null;
  return { id: row.id, featureId: row.feature_id, name: row.name, phase: row.phase, status: row.status, instructionJson: row.instruction_json, resultJson: row.result_json, createdAt: row.created_at, updatedAt: row.updated_at };
}
