CREATE TABLE `execution_hosts` (
  `id` text PRIMARY KEY NOT NULL,
  `execution_context_id` text NOT NULL,
  `name` text NOT NULL,
  `harness` text NOT NULL,
  `capabilities_json` text DEFAULT '[]' NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `last_seen_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_execution_hosts_context` ON `execution_hosts` (`execution_context_id`);
--> statement-breakpoint
CREATE TABLE `host_workspaces` (
  `id` text PRIMARY KEY NOT NULL,
  `host_id` text NOT NULL,
  `project_id` text NOT NULL,
  `workspace_ref` text NOT NULL,
  `working_path` text,
  `access_granted` integer DEFAULT 1 NOT NULL,
  `available` integer DEFAULT 0 NOT NULL,
  `verified_at` text,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_host_workspaces_host_project` ON `host_workspaces` (`host_id`, `project_id`);
--> statement-breakpoint
ALTER TABLE `attempt_claims` ADD `protocol_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `attempt_claims` ADD `claimed_at` text;
--> statement-breakpoint
ALTER TABLE `attempt_claims` ADD `parent_session_id` text;
--> statement-breakpoint
ALTER TABLE `attempt_claims` ADD `recovery_outcome` text;
--> statement-breakpoint
ALTER TABLE `attempt_claims` ADD `recovery_observed_at` text;
--> statement-breakpoint
ALTER TABLE `attempt_claims` ADD `recovery_details_json` text DEFAULT '{}' NOT NULL;
