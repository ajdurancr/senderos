export type HarnessKind = 'openclaw' | 'codex' | 'claude-code' | 'unknown';
export type ProjectStatus = 'healthy' | 'setup_failed' | 'broken' | 'archived';
export type IntegrationMode = 'github_pr' | 'local_merge';
export type GoalKind =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'maintenance'
  | 'security'
  | 'migration';
export type GoalStatus =
  | 'draft'
  | 'active'
  | 'failed'
  | 'blocked'
  | 'canceled'
  | 'completed';
export type RunStatus =
  | 'queued'
  | 'preparing'
  | 'executing'
  | 'validating'
  | 'repairing'
  | 'merging'
  | 'updating_pr'
  | 'cleaning_up'
  | 'succeeded'
  | 'failed'
  | 'canceled';
export type AgentKind = 'system' | 'default' | 'custom';
export type AgentStatus = 'active' | 'disabled' | 'archived';
export type AgentTransitionStatus =
  | 'draft'
  | 'active'
  | 'disabled'
  | 'archived';
export type RunAttemptStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export type EvidenceKind = 'test' | 'ci' | 'pull_request' | 'artifact' | 'manual';
export type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected';

export interface AttemptEvidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  url?: string;
  summary?: string;
  createdAt: string;
}

export interface AttemptReview {
  status: ReviewStatus;
  reviewer?: string;
  rationale?: string;
  reviewedAt?: string;
}

export interface SenderosConfig {
  database: {
    /** Environment variable containing a file: or remote libSQL URL. */
    urlEnv: string;
    /** Optional environment variable containing a libSQL auth token. */
    authTokenEnv?: string;
  };
  artifactRoot: string;
  logRoot: string;
  cacheRoot: string;
  defaultHarness: HarnessKind;
  output: { format: 'json' | 'text' };
  guardrails: { restrictToHome: boolean };
}
export interface RuntimePaths {
  home: string;
  configPath: string;
  dbPath?: string;
  artifactRoot: string;
  logRoot: string;
  cacheRoot: string;
}
export interface ProjectRecord {
  id: string;
  name: string;
  canonicalPath: string;
  githubOwner: string;
  githubRepo: string;
  githubRemote: string;
  targetBranch: string;
  status: ProjectStatus;
  integrationMode: IntegrationMode;
  inferredCommandsJson: string;
  healthDetailsJson: string;
  createdAt: string;
  updatedAt: string;
}
export interface GoalRecord {
  id: string;
  projectId: string;
  title: string;
  kind: GoalKind;
  intakeText: string;
  specText: string;
  status: GoalStatus;
  baseTargetBranch: string;
  branchName: string | null;
  prUrl: string | null;
  prNumber: number | null;
  createdAt: string;
  updatedAt: string;
}
export interface RunRecord {
  id: string;
  goal_id: string;
  status: RunStatus;
  branch_name: string | null;
  base_branch: string | null;
  max_attempts: number;
  created_at: string;
  updated_at: string;
}
export interface AgentRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: AgentKind;
  status: AgentStatus;
  definitionFormat: string;
  definitionBody: string;
  defaultGoal: string | null;
  defaultMetaJson: string;
  createdAt: string;
  updatedAt: string;
}
export interface AgentTransitionRecord {
  id: string;
  sourceAgentId: string;
  targetAgentId: string | null;
  name: string;
  description: string;
  status: AgentTransitionStatus;
  transitionObjective: string;
  assignmentMetaJson: string;
  createdAt: string;
  updatedAt: string;
}
export interface RunAttemptRecord {
  id: string;
  runId: string;
  attemptNumber: number;
  agentId: string;
  transitionId: string | null;
  status: RunAttemptStatus;
  executionObjective: string;
  harness: HarnessKind;
  externalSessionId: string | null;
  resumeCommand: string | null;
  heartbeatAt: string | null;
  hostEnvironmentName: string | null;
  workingPath: string | null;
  workingPathMode: string | null;
  retryFromAttemptId: string | null;
  checkpoint: string | null;
  sourceGoalSha: string | null;
  failureStep: string | null;
  statusSnapshotJson: string;
  resultJson: string;
  failureSummary: string | null;
  debugMetaJson: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface SeedAgentsOptions {
  definitionsDir?: string;
}
export interface InitPreview {
  home: string;
  configPath: string;
  config: SenderosConfig;
  inferredHarness: HarnessKind;
  assumptions: string[];
  requiresApproval: true;
}
export interface CommandHelp {
  command: string;
  summary: string;
  agentDescription?: string;
  usage: string[];
  arguments?: Array<{ name: string; description: string; required?: boolean }>;
  options?: Array<{ name: string; description: string; required?: boolean }>;
  subcommands?: CommandHelp[];
}
