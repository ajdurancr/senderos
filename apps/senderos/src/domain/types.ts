export type DatabaseKind = 'local' | 'turso';
export type HarnessKind = 'openclaw' | 'codex' | 'claude-code' | 'unknown';

export type ProjectStatus = 'healthy' | 'setup_failed' | 'broken' | 'archived';
export type IntegrationMode = 'github_pr' | 'local_merge';
export type FeatureStatus =
  | 'awaiting_scenario_approval'
  | 'active'
  | 'failed'
  | 'blocked'
  | 'canceled'
  | 'completed';
export type LoopPhase = 'idle' | 'implementation' | 'review' | 'mutation' | 'done' | 'blocked';
export type TaskStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'canceled';
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
export type SessionStatus = 'active' | 'stale' | 'completed' | 'failed';
export type WorkspaceStatus = 'allocated' | 'locked' | 'active' | 'verifying' | 'released' | 'cleaned' | 'retained';

export interface SenderosConfig {
  database: { kind: DatabaseKind; path?: string; turso?: { url: string; authTokenEnv: string } };
  workspaceRoot: string;
  artifactRoot: string;
  logRoot: string;
  sessionRoot: string;
  cacheRoot: string;
  defaultHarness: HarnessKind;
  output: { format: 'json' | 'text' };
  guardrails: { restrictToHome: boolean };
}

export interface RuntimePaths {
  home: string;
  configPath: string;
  dbPath: string;
  workspaceRoot: string;
  artifactRoot: string;
  logRoot: string;
  sessionRoot: string;
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

export interface FeatureRecord {
  id: string;
  projectId: string;
  title: string;
  specText: string;
  sourceRequestText: string;
  gherkinText: string;
  gherkinMetaJson: string;
  status: FeatureStatus;
  loopPhase: LoopPhase;
  baseTargetBranch: string;
  featureBranchName: string | null;
  prUrl: string | null;
  prNumber: number | null;
  currentWorkspaceId: string | null;
  currentRunId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  featureId: string;
  name: string;
  phase: LoopPhase;
  status: TaskStatus;
  instructionJson: string;
  resultJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitPreview {
  home: string;
  configPath: string;
  config: SenderosConfig;
  inferredHarness: HarnessKind;
  assumptions: string[];
  requiresApproval: true;
}

export interface DbAdapter {
  kind: DatabaseKind;
  describe(home?: string): Record<string, unknown>;
  healthcheck(home?: string): { ok: boolean; issues: string[]; warnings?: string[] };
  openCommandConnection?(home?: string): unknown;
}

export interface CommandHelp {
  command: string;
  summary: string;
  usage: string[];
  arguments?: Array<{ name: string; description: string; required?: boolean }>;
  options?: Array<{ name: string; description: string; required?: boolean }>;
  subcommands?: CommandHelp[];
}
