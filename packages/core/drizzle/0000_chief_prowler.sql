CREATE TABLE `agent_transitions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_agent_id` text NOT NULL,
	`target_agent_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`transition_objective` text NOT NULL,
	`assignment_meta_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_transitions_source_agent` ON `agent_transitions` (`source_agent_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_transitions_target_agent` ON `agent_transitions` (`target_agent_id`);--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`definition_format` text DEFAULT 'markdown' NOT NULL,
	`definition_body` text NOT NULL,
	`default_goal` text,
	`default_meta_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_agents_slug` ON `agents` (`slug`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`intake_text` text DEFAULT '' NOT NULL,
	`spec_text` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`base_target_branch` text NOT NULL,
	`branch_name` text,
	`pr_url` text,
	`pr_number` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`canonical_path` text NOT NULL,
	`github_owner` text NOT NULL,
	`github_repo` text NOT NULL,
	`github_remote` text NOT NULL,
	`target_branch` text NOT NULL,
	`status` text NOT NULL,
	`integration_mode` text NOT NULL,
	`inferred_commands_json` text DEFAULT '{}' NOT NULL,
	`health_details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `run_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`agent_id` text NOT NULL,
	`transition_id` text,
	`status` text NOT NULL,
	`execution_objective` text NOT NULL,
	`harness` text NOT NULL,
	`external_session_id` text,
	`resume_command` text,
	`heartbeat_at` text,
	`host_environment_name` text,
	`working_path` text,
	`working_path_mode` text,
	`retry_from_attempt_id` text,
	`checkpoint` text,
	`source_goal_sha` text,
	`failure_step` text,
	`status_snapshot_json` text DEFAULT '{}' NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`failure_summary` text,
	`debug_meta_json` text DEFAULT '{}' NOT NULL,
	`started_at` text,
	`finished_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_run_attempts_run` ON `run_attempts` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_run_attempts_agent` ON `run_attempts` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_run_attempts_transition` ON `run_attempts` (`transition_id`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`status` text NOT NULL,
	`branch_name` text,
	`base_branch` text,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
