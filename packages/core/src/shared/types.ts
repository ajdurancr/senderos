export type HarnessKind = "openclaw" | "codex" | "claude-code" | "unknown";
export type ProjectStatus = "healthy" | "setup_failed" | "broken" | "archived";
export type IntegrationMode = "github_pr" | "local_merge";
export type GoalKind =
  | "feature"
  | "bugfix"
  | "refactor"
  | "maintenance"
  | "security"
  | "migration";
export type GoalStatus =
  | "draft"
  | "active"
  | "failed"
  | "blocked"
  | "canceled"
  | "completed";
export type RunStatus =
  | "queued"
  | "preparing"
  | "executing"
  | "validating"
  | "repairing"
  | "merging"
  | "updating_pr"
  | "cleaning_up"
  | "succeeded"
  | "failed"
  | "canceled";
export type AgentKind = "system" | "default" | "custom";
export type AgentStatus = "active" | "disabled" | "archived";
export type AgentTransitionStatus =
  | "draft"
  | "active"
  | "disabled"
  | "archived";
export type SenderoStatus = "draft" | "active" | "archived";
export type SenderoVersionStatus = "draft" | "published" | "retired";
export type SenderoNodeKind = "start" | "agent" | "end";
export type RunAttemptStatus =
  | "queued"
  | "running"
  | "paused"
  | "succeeded"
  | "failed"
  | "canceled";

export type EvidenceKind =
  | "test"
  | "ci"
  | "pull_request"
  | "artifact"
  | "manual";
export type ReviewStatus =
  | "pending"
  | "approved"
  | "changes_requested"
  | "rejected";

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
  output: { format: "json" | "text" };
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
export type ProjectRecord = Omit<
  typeof projects.$inferSelect,
  "status" | "integrationMode"
> & {
  status: ProjectStatus;
  integrationMode: IntegrationMode;
};
export type GoalRecord = Omit<typeof goals.$inferSelect, "kind" | "status"> & {
  kind: GoalKind;
  status: GoalStatus;
};
export type RunRecord = Omit<typeof runs.$inferSelect, "status"> & {
  status: RunStatus;
};
export type AgentRecord = Omit<
  typeof agents.$inferSelect,
  "kind" | "status"
> & {
  kind: AgentKind;
  status: AgentStatus;
};
export type AgentTransitionRecord = Omit<
  typeof agentTransitions.$inferSelect,
  "status"
> & { status: AgentTransitionStatus };
export type SenderoRecord = Omit<typeof senderos.$inferSelect, "status"> & {
  status: SenderoStatus;
};
export type SenderoVersionRecord = Omit<
  typeof senderoVersions.$inferSelect,
  "status"
> & { status: SenderoVersionStatus };
export type SenderoNodeRecord = Omit<typeof senderoNodes.$inferSelect, "kind"> & {
  kind: SenderoNodeKind;
};
export type SenderoEdgeRecord = Omit<typeof senderoEdges.$inferSelect, "status"> & {
  status: AgentTransitionStatus;
};
export interface SenderoGraph {
  sendero: SenderoRecord;
  version: SenderoVersionRecord;
  nodes: SenderoNodeRecord[];
  edges: SenderoEdgeRecord[];
}
export type RunAttemptRecord = Omit<
  typeof runAttempts.$inferSelect,
  "harness" | "status"
> & { harness: HarnessKind; status: RunAttemptStatus };
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
import type {
  agents,
  agentTransitions,
  goals,
  projects,
  runAttempts,
  runs,
  senderoEdges,
  senderoNodes,
  senderos,
  senderoVersions,
} from "../db/schema";
