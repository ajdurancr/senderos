CREATE TABLE `sendero_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`sendero_version_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`transition_objective` text NOT NULL,
	`condition_json` text DEFAULT '{}' NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sendero_edges_version` ON `sendero_edges` (`sendero_version_id`);--> statement-breakpoint
CREATE TABLE `sendero_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`sendero_version_id` text NOT NULL,
	`agent_id` text,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`position_x` integer NOT NULL,
	`position_y` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sendero_nodes_version` ON `sendero_nodes` (`sendero_version_id`);--> statement-breakpoint
CREATE TABLE `sendero_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`sendero_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sendero_versions_number` ON `sendero_versions` (`sendero_id`,`version`);--> statement-breakpoint
CREATE TABLE `senderos` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_senderos_slug` ON `senderos` (`slug`);--> statement-breakpoint
ALTER TABLE `goals` ADD `sendero_version_id` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `sendero_version_id` text;