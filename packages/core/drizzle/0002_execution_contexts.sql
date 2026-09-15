CREATE TABLE `execution_contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_execution_contexts_name` ON `execution_contexts` (`name`);
--> statement-breakpoint
INSERT INTO `execution_contexts` (`id`, `name`, `created_at`, `updated_at`)
SELECT 'context-legacy', 'Legacy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM `projects` LIMIT 1);
--> statement-breakpoint
ALTER TABLE `projects` ADD `execution_context_id` text NOT NULL DEFAULT 'context-legacy';
--> statement-breakpoint
CREATE INDEX `idx_projects_execution_context` ON `projects` (`execution_context_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_projects_context_name` ON `projects` (`execution_context_id`, `name`);
