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
export type RunPhase = 'idle' | 'implementation' | 'review' | 'mutation' | 'done' | 'blocked';
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
export type AgentKind = 'system' | 'default' | 'custom';
export type AgentStatus = 'active' | 'disabled' | 'archived';
export type SenderoStatus = 'draft' | 'active' | 'disabled' | 'archived';
export type SenderoGoalMode = 'terminal' | 'toward_agent';
export type RunExecutionStatus = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'canceled';

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

export interface ProjectRecord { id:string; name:string; canonicalPath:string; githubOwner:string; githubRepo:string; githubRemote:string; targetBranch:string; status:ProjectStatus; integrationMode:IntegrationMode; inferredCommandsJson:string; healthDetailsJson:string; createdAt:string; updatedAt:string; }
export interface FeatureRecord { id:string; projectId:string; title:string; specText:string; sourceRequestText:string; gherkinText:string; gherkinMetaJson:string; status:FeatureStatus; runPhase:RunPhase; baseTargetBranch:string; featureBranchName:string|null; prUrl:string|null; prNumber:number|null; currentWorkspaceId:string|null; currentRunId:string|null; createdAt:string; updatedAt:string; }
export interface TaskRecord { id:string; featureId:string; name:string; phase:RunPhase; status:TaskStatus; instructionJson:string; resultJson:string; createdAt:string; updatedAt:string; }
export interface AgentRecord { id:string; slug:string; name:string; description:string; kind:AgentKind; status:AgentStatus; sourcePath:string|null; definitionFormat:string; definitionBody:string; defaultGoal:string|null; defaultMetaJson:string; createdAt:string; updatedAt:string; }
export interface SenderoRecord { id:string; sourceAgentId:string; targetAgentId:string|null; name:string; description:string; status:SenderoStatus; goal:string; goalMode:SenderoGoalMode; assignmentMetaJson:string; createdAt:string; updatedAt:string; }
export interface RunExecutionRecord { id:string; runId:string|null; featureId:string|null; attemptNumber:number; agentId:string; senderoId:string|null; targetAgentId:string|null; status:RunExecutionStatus; goal:string; hostEnvironmentName:string|null; hostEnvironmentSessionId:string|null; harness:HarnessKind; checkpoint:string|null; sourceFeatureSha:string|null; failureStep:string|null; statusSnapshotJson:string; resultJson:string; failureSummary:string|null; debugMetaJson:string; startedAt:string|null; finishedAt:string|null; createdAt:string; updatedAt:string; }
export interface SeedAgentsOptions { definitionsDir?: string; }
export interface InitPreview { home:string; configPath:string; config:SenderosConfig; inferredHarness:HarnessKind; assumptions:string[]; requiresApproval:true; }
export interface DbAdapter { kind:DatabaseKind; describe(home?:string):Record<string,unknown>; healthcheck(home?:string):{ok:boolean;issues:string[];warnings?:string[]}; openCommandConnection?(home?:string):unknown; }
export interface CommandHelp { command:string; summary:string; usage:string[]; arguments?:Array<{name:string;description:string;required?:boolean}>; options?:Array<{name:string;description:string;required?:boolean}>; subcommands?:CommandHelp[]; }
