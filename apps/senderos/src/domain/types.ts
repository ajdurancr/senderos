export type DatabaseKind = "local" | "turso";
export type HarnessKind = "openclaw" | "codex" | "claude-code" | "unknown";
export type FeatureStatus = "defined" | "ready_contract" | "active_implementation" | "verifying_review" | "verifying_mutation" | "completed" | "failed" | "canceled";
export type LoopPhase = "idle" | "contract" | "implementation" | "review" | "mutation" | "done" | "blocked";
export type TaskStatus = "pending" | "ready" | "running" | "completed" | "failed" | "canceled";
export type RunStatus = "queued" | "running" | "completed" | "failed" | "canceled";
export type SessionStatus = "active" | "stale" | "completed" | "failed";
export type WorkspaceStatus = "allocated" | "locked" | "active" | "verifying" | "released" | "cleaned" | "retained";

export interface SenderosConfig {
  database: { kind: DatabaseKind; path?: string; turso?: { url: string; authTokenEnv: string } };
  workspaceRoot: string;
  artifactRoot: string;
  logRoot: string;
  sessionRoot: string;
  cacheRoot: string;
  defaultHarness: HarnessKind;
  output: { format: "json" | "text" };
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

export interface FeatureRecord {
  id: string;
  title: string;
  problemStatement: string;
  contractText: string;
  status: FeatureStatus;
  loopPhase: LoopPhase;
  completionCriteria: string;
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
