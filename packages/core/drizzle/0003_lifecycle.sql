CREATE TABLE goal_executions (
 goal_id text PRIMARY KEY NOT NULL, transition_id text, latest_run_id text,
 attempts_used integer NOT NULL DEFAULT 0, max_attempts integer NOT NULL DEFAULT 3,
 revision integer NOT NULL DEFAULT 0, finished_at text
);
--> statement-breakpoint
CREATE TABLE attempt_claims (
 attempt_id text PRIMARY KEY NOT NULL, owner_id text, token text, lease_expires_at text,
 cancellation_requested_at text, acknowledged_at text, packet_json text NOT NULL DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE lifecycle_requests (
 id text PRIMARY KEY NOT NULL, goal_id text NOT NULL, fingerprint text NOT NULL, response_json text NOT NULL
);
