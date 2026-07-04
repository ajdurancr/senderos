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
    create table if not exists features (
      id text primary key,
      project_id text not null,
      title text not null,
      spec_text text not null default '',
      source_request_text text not null default '',
      gherkin_text text not null default '',
      gherkin_meta_json text not null default '{}',
      status text not null,
      sendero_step text not null,
      base_target_branch text not null,
      feature_branch_name text,
      pr_url text,
      pr_number integer,
      current_workspace_id text,
      current_run_id text,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists tasks (
      id text primary key,
      feature_id text not null,
      name text not null,
      phase text not null,
      status text not null,
      instruction_json text not null,
      result_json text not null default '{}',
      created_at text not null,
      updated_at text not null
    );
    create table if not exists runs (
      id text primary key,
      feature_id text not null,
      task_id text,
      phase text not null,
      status text not null,
      branch_name text,
      base_branch text,
      max_attempts integer not null default 3,
      attempt_count integer not null default 0,
      current_attempt integer not null default 0,
      instruction_json text not null,
      result_json text not null default '{}',
      created_at text not null,
      updated_at text not null
    );
    create table if not exists sessions (
      id text primary key,
      run_id text,
      harness text not null,
      external_session_id text,
      status text not null,
      status_snapshot_json text not null default '{}',
      heartbeat_at text,
      resume_command text,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists workspaces (
      id text primary key,
      feature_id text,
      run_id text,
      session_id text,
      root_path text not null,
      status text not null,
      branch_name text,
      retention_reason text,
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
      source_path text,
      definition_format text not null default 'markdown',
      definition_body text not null,
      default_goal text,
      default_meta_json text not null default '{}',
      created_at text not null,
      updated_at text not null
    );
    create table if not exists senderos (
      id text primary key,
      source_agent_id text not null,
      target_agent_id text,
      name text not null,
      description text not null default '',
      status text not null,
      goal text not null,
      goal_mode text not null,
      assignment_meta_json text not null default '{}',
      created_at text not null,
      updated_at text not null
    );
    create table if not exists run_executions (
      id text primary key,
      run_id text not null,
      feature_id text,
      attempt_number integer not null default 1,
      agent_id text not null,
      sendero_id text,
      target_agent_id text,
      status text not null,
      goal text not null,
      host_environment_name text,
      host_environment_session_id text,
      harness text not null,
      checkpoint text,
      source_feature_sha text,
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
    create index if not exists idx_senderos_source_agent on senderos(source_agent_id);
    create index if not exists idx_senderos_target_agent on senderos(target_agent_id);
    create index if not exists idx_run_executions_run on run_executions(run_id);
    create index if not exists idx_run_executions_agent on run_executions(agent_id);
    create index if not exists idx_run_executions_sendero on run_executions(sendero_id);
  `);
}
