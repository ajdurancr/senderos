import type {
  AgentRecord,
  AgentTransitionRecord,
  GoalRecord,
  ProjectRecord,
  RunAttemptRecord,
} from '../domain/types';

export function mapProjectRow(row: any): ProjectRecord | null {
  return row
    ? {
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
      }
    : null;
}
export function mapGoalRow(row: any): GoalRecord | null {
  return row
    ? {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        kind: row.kind,
        intakeText: row.intake_text,
        specText: row.spec_text,
        status: row.status,
        baseTargetBranch: row.base_target_branch,
        branchName: row.branch_name,
        prUrl: row.pr_url,
        prNumber: row.pr_number,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}
export function mapAgentRow(row: any): AgentRecord | null {
  return row
    ? {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        kind: row.kind,
        status: row.status,
        definitionFormat: row.definition_format,
        definitionBody: row.definition_body,
        defaultGoal: row.default_goal,
        defaultMetaJson: row.default_meta_json,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}
export function mapAgentTransitionRow(row: any): AgentTransitionRecord | null {
  return row
    ? {
        id: row.id,
        sourceAgentId: row.source_agent_id,
        targetAgentId: row.target_agent_id,
        name: row.name,
        description: row.description,
        status: row.status,
        transitionObjective: row.transition_objective,
        assignmentMetaJson: row.assignment_meta_json,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}
export function mapRunAttemptRow(row: any): RunAttemptRecord | null {
  return row
    ? {
        id: row.id,
        runId: row.run_id,
        attemptNumber: row.attempt_number,
        agentId: row.agent_id,
        transitionId: row.transition_id,
        status: row.status,
        executionObjective: row.execution_objective,
        harness: row.harness,
        externalSessionId: row.external_session_id,
        resumeCommand: row.resume_command,
        heartbeatAt: row.heartbeat_at,
        hostEnvironmentName: row.host_environment_name,
        workingPath: row.working_path,
        workingPathMode: row.working_path_mode,
        retryFromAttemptId: row.retry_from_attempt_id,
        checkpoint: row.checkpoint,
        sourceGoalSha: row.source_goal_sha,
        failureStep: row.failure_step,
        statusSnapshotJson: row.status_snapshot_json,
        resultJson: row.result_json,
        failureSummary: row.failure_summary,
        debugMetaJson: row.debug_meta_json,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}
