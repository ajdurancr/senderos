export type DatabaseKind = "local" | "turso";
export type FeatureStatus = "defined" | "ready" | "active" | "verifying" | "completed" | "failed" | "canceled";
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
  defaultHarness: string;
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
