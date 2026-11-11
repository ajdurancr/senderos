CREATE INDEX `events_created_at_id_idx` ON `events` (`created_at`, `id`);
--> statement-breakpoint
CREATE INDEX `events_entity_created_at_id_idx` ON `events` (`entity_id`, `created_at`, `id`);
