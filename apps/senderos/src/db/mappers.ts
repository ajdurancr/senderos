import type { FeatureRecord, ProjectRecord, TaskRecord } from '../domain/types';

export function mapProjectRow(row: any): ProjectRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    canonicalPath: row.canonical_path,
    githubOwner: row.github_owner,
    githubRepo: row.github_repo,
    githubRemote: row.github_remote,
    targetBranch: row.target_branch,
    status: row.status,
    integrationMode: row.integration_mode,
    inferredCommandsJson: row.inferred_commands_json,
    healthDetailsJson: row.health_details_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapFeatureRow(row: any): FeatureRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    specText: row.spec_text,
    sourceRequestText: row.source_request_text,
    gherkinText: row.gherkin_text,
    gherkinMetaJson: row.gherkin_meta_json,
    status: row.status,
    loopPhase: row.loop_phase,
    baseTargetBranch: row.base_target_branch,
    featureBranchName: row.feature_branch_name,
    prUrl: row.pr_url,
    prNumber: row.pr_number,
    currentWorkspaceId: row.current_workspace_id,
    currentRunId: row.current_run_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTaskRow(row: any): TaskRecord | null {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    featureId: row.feature_id,
    name: row.name,
    phase: row.phase,
    status: row.status,
    instructionJson: row.instruction_json,
    resultJson: row.result_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
