import type { Database } from 'bun:sqlite';

export function migrate(db: Database) {
  db.exec(`
    create table if not exists projects (
      id text primary key,
      name text not null,
      canonical_path text not null,
      github_owner text not null,
      github_repo text not null,
      github_remote text not null,
      target_branch text not null,
      status text not null,
      integration_mode text not null,
      inferred_commands_json text not null default '{}',
      health_details_json text not null default '{}',
      created_at text not null,
      updated_at text not null
    );
    create table if not exists goals (
      id text primary key,
      project_id text not null,
      title text not null,
      kind text not null,
      intake_text text not null default '',
      spec_text text not null default '',
      status text not null,
      base_target_branch text not null,
      branch_name text,
      pr_url text,
      pr_number integer,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists runs (
      id text primary key,
      goal_id text not null,
      status text not null,
      branch_name text,
      base_branch text,
      max_attempts integer not null default 3,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists agents (
      id text primary key,
      slug text not null unique,
      name text not null,
      description text not null default '',
      kind text not null,
      status text not null,
      definition_format text not null default 'markdown',
      definition_body text not null,
      default_goal text,
      default_meta_json text not null default '{}',
      created_at text not null,
      updated_at text not null
    );
    create table if not exists agent_transitions (
      id text primary key,
      source_agent_id text not null,
      target_agent_id text,
      name text not null,
      description text not null default '',
      status text not null,
      transition_objective text not null,
      assignment_meta_json text not null default '{}',
      created_at text not null,
      updated_at text not null
    );
    create table if not exists run_attempts (
      id text primary key,
      run_id text not null,
      attempt_number integer not null,
      agent_id text not null,
      transition_id text,
      status text not null,
      execution_objective text not null,
      harness text not null,
      external_session_id text,
      resume_command text,
      heartbeat_at text,
      host_environment_name text,
      working_path text,
      working_path_mode text,
      retry_from_attempt_id text,
      checkpoint text,
      source_goal_sha text,
      failure_step text,
      status_snapshot_json text not null default '{}',
      result_json text not null default '{}',
      failure_summary text,
      debug_meta_json text not null default '{}',
      started_at text,
      finished_at text,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists events (
      id text primary key,
      event_type text not null,
      entity_type text not null,
      entity_id text not null,
      payload_json text not null,
      created_at text not null
    );
    create index if not exists idx_agents_slug on agents(slug);
    create index if not exists idx_agent_transitions_source_agent on agent_transitions(source_agent_id);
    create index if not exists idx_agent_transitions_target_agent on agent_transitions(target_agent_id);
    create index if not exists idx_run_attempts_run on run_attempts(run_id);
    create index if not exists idx_run_attempts_agent on run_attempts(agent_id);
    create index if not exists idx_run_attempts_transition on run_attempts(transition_id);
  `);
}
