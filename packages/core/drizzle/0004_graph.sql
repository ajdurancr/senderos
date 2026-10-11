ALTER TABLE sendero_versions ADD COLUMN max_activations integer NOT NULL DEFAULT 100;
--> statement-breakpoint
ALTER TABLE sendero_versions ADD COLUMN protocol_version integer NOT NULL DEFAULT 2;
--> statement-breakpoint
-- Only versions that already existed before this migration retain legacy reporting.
UPDATE sendero_versions SET protocol_version = 1;
--> statement-breakpoint
ALTER TABLE sendero_nodes ADD COLUMN execution_objective text;
--> statement-breakpoint
ALTER TABLE sendero_nodes ADD COLUMN completion_json text NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE sendero_nodes ADD COLUMN requirements_json text NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE sendero_nodes ADD COLUMN join_fork_node_id text;
--> statement-breakpoint
ALTER TABLE sendero_nodes ADD COLUMN agent_snapshot_json text;
--> statement-breakpoint
ALTER TABLE runs ADD COLUMN activation_id text;
--> statement-breakpoint
ALTER TABLE goal_executions ADD COLUMN max_activations integer NOT NULL DEFAULT 100;
--> statement-breakpoint
ALTER TABLE goal_executions ADD COLUMN activations_used integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE goal_executions ADD COLUMN cancellation_requested_at text;
--> statement-breakpoint
CREATE TABLE activations (id text PRIMARY KEY NOT NULL, goal_id text NOT NULL, node_id text NOT NULL, transition_id text NOT NULL, parent_activation_id text, previous_run_id text, latest_run_id text, status text NOT NULL, reason text, attempts_used integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3, revision integer NOT NULL DEFAULT 0, scopes_json text NOT NULL DEFAULT '[]', input_json text NOT NULL DEFAULT '{}', created_at text NOT NULL, updated_at text NOT NULL);
--> statement-breakpoint
CREATE INDEX idx_activations_goal ON activations (goal_id);
--> statement-breakpoint
CREATE TABLE fork_generations (id text PRIMARY KEY NOT NULL, goal_id text NOT NULL, fork_node_id text NOT NULL, fork_activation_id text, status text NOT NULL DEFAULT 'open', created_at text NOT NULL);
--> statement-breakpoint
CREATE INDEX idx_fork_generations_goal ON fork_generations (goal_id);
--> statement-breakpoint
-- Historic publication-time instructions were not stored. Pin their current
-- definitions at upgrade; subsequent publications capture their own snapshots.
UPDATE sendero_nodes SET agent_snapshot_json = (
  SELECT json_object('id', agents.id, 'name', agents.name, 'instructions', agents.definition_body,
    'requiredCapabilities', json(CASE WHEN json_valid(agents.default_meta_json) THEN
      CASE WHEN json_type(agents.default_meta_json, '$.requiredCapabilities') = 'array'
        THEN json_extract(agents.default_meta_json, '$.requiredCapabilities') ELSE '[]' END
      ELSE '[]' END))
  FROM agents WHERE agents.id = sendero_nodes.agent_id
) WHERE kind = 'agent' AND sendero_version_id IN (SELECT id FROM sendero_versions WHERE status = 'published');
