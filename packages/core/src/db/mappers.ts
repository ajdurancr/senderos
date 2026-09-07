import type {
  AgentRecord,
  AgentTransitionRecord,
  GoalRecord,
  ProjectRecord,
  RunAttemptRecord,
} from '../shared/types';

const value = (row: any, camel: string, snake: string) =>
  row[camel] === undefined ? row[snake] : row[camel];

export function mapProjectRow(row: any): ProjectRecord | null {
  return row
    ? {
        id: row.id,
        name: row.name,
        canonicalPath: value(row, 'canonicalPath', 'canonical_path'),
        githubOwner: value(row, 'githubOwner', 'github_owner'),
        githubRepo: value(row, 'githubRepo', 'github_repo'),
        githubRemote: value(row, 'githubRemote', 'github_remote'),
        targetBranch: value(row, 'targetBranch', 'target_branch'),
        status: row.status,
        integrationMode: value(row, 'integrationMode', 'integration_mode'),
        inferredCommandsJson: value(row, 'inferredCommandsJson', 'inferred_commands_json'),
        healthDetailsJson: value(row, 'healthDetailsJson', 'health_details_json'),
        createdAt: value(row, 'createdAt', 'created_at'),
        updatedAt: value(row, 'updatedAt', 'updated_at'),
      }
    : null;
}
export function mapGoalRow(row: any): GoalRecord | null {
  return row
    ? {
        id: row.id,
        projectId: value(row, 'projectId', 'project_id'),
        title: row.title,
        kind: row.kind,
        intakeText: value(row, 'intakeText', 'intake_text'),
        specText: value(row, 'specText', 'spec_text'),
        status: row.status,
        baseTargetBranch: value(row, 'baseTargetBranch', 'base_target_branch'),
        branchName: value(row, 'branchName', 'branch_name'),
        prUrl: value(row, 'prUrl', 'pr_url'),
        prNumber: value(row, 'prNumber', 'pr_number'),
        createdAt: value(row, 'createdAt', 'created_at'),
        updatedAt: value(row, 'updatedAt', 'updated_at'),
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
        definitionFormat: value(row, 'definitionFormat', 'definition_format'),
        definitionBody: value(row, 'definitionBody', 'definition_body'),
        defaultGoal: value(row, 'defaultGoal', 'default_goal'),
        defaultMetaJson: value(row, 'defaultMetaJson', 'default_meta_json'),
        createdAt: value(row, 'createdAt', 'created_at'),
        updatedAt: value(row, 'updatedAt', 'updated_at'),
      }
    : null;
}
export function mapAgentTransitionRow(row: any): AgentTransitionRecord | null {
  return row
    ? {
        id: row.id,
        sourceAgentId: value(row, 'sourceAgentId', 'source_agent_id'),
        targetAgentId: value(row, 'targetAgentId', 'target_agent_id'),
        name: row.name,
        description: row.description,
        status: row.status,
        transitionObjective: value(row, 'transitionObjective', 'transition_objective'),
        assignmentMetaJson: value(row, 'assignmentMetaJson', 'assignment_meta_json'),
        createdAt: value(row, 'createdAt', 'created_at'),
        updatedAt: value(row, 'updatedAt', 'updated_at'),
      }
    : null;
}
export function mapRunAttemptRow(row: any): RunAttemptRecord | null {
  return row
    ? {
        id: row.id,
        runId: value(row, 'runId', 'run_id'),
        attemptNumber: value(row, 'attemptNumber', 'attempt_number'),
        agentId: value(row, 'agentId', 'agent_id'),
        transitionId: value(row, 'transitionId', 'transition_id'),
        status: row.status,
        executionObjective: value(row, 'executionObjective', 'execution_objective'),
        harness: row.harness,
        externalSessionId: value(row, 'externalSessionId', 'external_session_id'),
        resumeCommand: value(row, 'resumeCommand', 'resume_command'),
        heartbeatAt: value(row, 'heartbeatAt', 'heartbeat_at'),
        hostEnvironmentName: value(row, 'hostEnvironmentName', 'host_environment_name'),
        workingPath: value(row, 'workingPath', 'working_path'),
        workingPathMode: value(row, 'workingPathMode', 'working_path_mode'),
        retryFromAttemptId: value(row, 'retryFromAttemptId', 'retry_from_attempt_id'),
        checkpoint: row.checkpoint,
        sourceGoalSha: value(row, 'sourceGoalSha', 'source_goal_sha'),
        failureStep: value(row, 'failureStep', 'failure_step'),
        statusSnapshotJson: value(row, 'statusSnapshotJson', 'status_snapshot_json'),
        resultJson: value(row, 'resultJson', 'result_json'),
        failureSummary: value(row, 'failureSummary', 'failure_summary'),
        debugMetaJson: value(row, 'debugMetaJson', 'debug_meta_json'),
        startedAt: value(row, 'startedAt', 'started_at'),
        finishedAt: value(row, 'finishedAt', 'finished_at'),
        createdAt: value(row, 'createdAt', 'created_at'),
        updatedAt: value(row, 'updatedAt', 'updated_at'),
      }
    : null;
}
