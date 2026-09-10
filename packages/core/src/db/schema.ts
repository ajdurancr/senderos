import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  canonicalPath: text("canonical_path").notNull(),
  githubOwner: text("github_owner").notNull(),
  githubRepo: text("github_repo").notNull(),
  githubRemote: text("github_remote").notNull(),
  targetBranch: text("target_branch").notNull(),
  status: text("status").notNull(),
  integrationMode: text("integration_mode").notNull(),
  inferredCommandsJson: text("inferred_commands_json").notNull().default("{}"),
  healthDetailsJson: text("health_details_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const senderos = sqliteTable(
  "senderos",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull(),
    currentVersion: integer("current_version").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_senderos_slug").on(table.slug)],
);

export const senderoVersions = sqliteTable(
  "sendero_versions",
  {
    id: text("id").primaryKey(),
    senderoId: text("sendero_id").notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_sendero_versions_number").on(table.senderoId, table.version),
  ],
);

export const senderoNodes = sqliteTable(
  "sendero_nodes",
  {
    id: text("id").primaryKey(),
    senderoVersionId: text("sendero_version_id").notNull(),
    agentId: text("agent_id"),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    positionX: integer("position_x").notNull(),
    positionY: integer("position_y").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_sendero_nodes_version").on(table.senderoVersionId)],
);

export const senderoEdges = sqliteTable(
  "sendero_edges",
  {
    id: text("id").primaryKey(),
    senderoVersionId: text("sendero_version_id").notNull(),
    sourceNodeId: text("source_node_id").notNull(),
    targetNodeId: text("target_node_id").notNull(),
    transitionId: text("transition_id"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    transitionObjective: text("transition_objective").notNull(),
    conditionJson: text("condition_json").notNull().default("{}"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_sendero_edges_version").on(table.senderoVersionId)],
);

export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  intakeText: text("intake_text").notNull().default(""),
  specText: text("spec_text").notNull().default(""),
  status: text("status").notNull(),
  senderoVersionId: text("sendero_version_id"),
  baseTargetBranch: text("base_target_branch").notNull(),
  branchName: text("branch_name"),
  prUrl: text("pr_url"),
  prNumber: integer("pr_number"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  goalId: text("goal_id").notNull(),
  status: text("status").notNull(),
  branchName: text("branch_name"),
  baseBranch: text("base_branch"),
  maxAttempts: integer("max_attempts").notNull().default(3),
  senderoVersionId: text("sendero_version_id"),
  senderoSnapshotJson: text("sendero_snapshot_json").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const agents = sqliteTable(
  "agents",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    definitionFormat: text("definition_format").notNull().default("markdown"),
    definitionBody: text("definition_body").notNull(),
    defaultGoal: text("default_goal"),
    defaultMetaJson: text("default_meta_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("idx_agents_slug").on(table.slug)],
);

export const agentTransitions = sqliteTable(
  "agent_transitions",
  {
    id: text("id").primaryKey(),
    sourceAgentId: text("source_agent_id").notNull(),
    targetAgentId: text("target_agent_id"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull(),
    transitionObjective: text("transition_objective").notNull(),
    assignmentMetaJson: text("assignment_meta_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_agent_transitions_source_agent").on(table.sourceAgentId),
    index("idx_agent_transitions_target_agent").on(table.targetAgentId),
  ],
);

export const runAttempts = sqliteTable(
  "run_attempts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    agentId: text("agent_id").notNull(),
    transitionId: text("transition_id"),
    status: text("status").notNull(),
    executionObjective: text("execution_objective").notNull(),
    harness: text("harness").notNull(),
    externalSessionId: text("external_session_id"),
    resumeCommand: text("resume_command"),
    heartbeatAt: text("heartbeat_at"),
    hostEnvironmentName: text("host_environment_name"),
    workingPath: text("working_path"),
    workingPathMode: text("working_path_mode"),
    retryFromAttemptId: text("retry_from_attempt_id"),
    checkpoint: text("checkpoint"),
    sourceGoalSha: text("source_goal_sha"),
    failureStep: text("failure_step"),
    statusSnapshotJson: text("status_snapshot_json").notNull().default("{}"),
    resultJson: text("result_json").notNull().default("{}"),
    failureSummary: text("failure_summary"),
    debugMetaJson: text("debug_meta_json").notNull().default("{}"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_run_attempts_run").on(table.runId),
    index("idx_run_attempts_agent").on(table.agentId),
    index("idx_run_attempts_transition").on(table.transitionId),
  ],
);

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payloadJson: text("payload_json").notNull(),
  createdAt: text("created_at").notNull(),
});
