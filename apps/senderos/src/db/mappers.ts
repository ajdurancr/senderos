import type { AgentRecord, FeatureRecord, ProjectRecord, RunExecutionRecord, SenderoRecord, TaskRecord } from '../domain/types';

export function mapProjectRow(row: any): ProjectRecord | null {
  if (!row) return null;
  return { id: row.id, name: row.name, canonicalPath: row.canonical_path, githubOwner: row.github_owner, githubRepo: row.github_repo, githubRemote: row.github_remote, targetBranch: row.target_branch, status: row.status, integrationMode: row.integration_mode, inferredCommandsJson: row.inferred_commands_json, healthDetailsJson: row.health_details_json, createdAt: row.created_at, updatedAt: row.updated_at };
}
export function mapFeatureRow(row: any): FeatureRecord | null {
  if (!row) return null;
  return { id: row.id, projectId: row.project_id, title: row.title, specText: row.spec_text, sourceRequestText: row.source_request_text, gherkinText: row.gherkin_text, gherkinMetaJson: row.gherkin_meta_json, status: row.status, senderoStep: row.sendero_step, baseTargetBranch: row.base_target_branch, featureBranchName: row.feature_branch_name, prUrl: row.pr_url, prNumber: row.pr_number, currentWorkspaceId: row.current_workspace_id, currentRunId: row.current_run_id, createdAt: row.created_at, updatedAt: row.updated_at };
}
export function mapTaskRow(row: any): TaskRecord | null {
  if (!row) return null;
  return { id: row.id, featureId: row.feature_id, name: row.name, phase: row.phase, status: row.status, instructionJson: row.instruction_json, resultJson: row.result_json, createdAt: row.created_at, updatedAt: row.updated_at };
}
export function mapAgentRow(row: any): AgentRecord | null {
  if (!row) return null;
  return { id: row.id, slug: row.slug, name: row.name, description: row.description, kind: row.kind, status: row.status, sourcePath: row.source_path, definitionFormat: row.definition_format, definitionBody: row.definition_body, defaultGoal: row.default_goal, defaultMetaJson: row.default_meta_json, createdAt: row.created_at, updatedAt: row.updated_at };
}
export function mapSenderoRow(row: any): SenderoRecord | null {
  if (!row) return null;
  return { id: row.id, sourceAgentId: row.source_agent_id, targetAgentId: row.target_agent_id, name: row.name, description: row.description, status: row.status, goal: row.goal, goalMode: row.goal_mode, assignmentMetaJson: row.assignment_meta_json, createdAt: row.created_at, updatedAt: row.updated_at };
}
export function mapRunExecutionRow(row: any): RunExecutionRecord | null {
  if (!row) return null;
  return { id: row.id, runId: row.run_id, featureId: row.feature_id, attemptNumber: row.attempt_number, agentId: row.agent_id, senderoId: row.sendero_id, targetAgentId: row.target_agent_id, status: row.status, goal: row.goal, hostEnvironmentName: row.host_environment_name, hostEnvironmentSessionId: row.host_environment_session_id, harness: row.harness, checkpoint: row.checkpoint, sourceFeatureSha: row.source_feature_sha, failureStep: row.failure_step, statusSnapshotJson: row.status_snapshot_json, resultJson: row.result_json, failureSummary: row.failure_summary, debugMetaJson: row.debug_meta_json, startedAt: row.started_at, finishedAt: row.finished_at, createdAt: row.created_at, updatedAt: row.updated_at };
}
