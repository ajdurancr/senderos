import type { Database } from "bun:sqlite";
export function migrate(db: Database) {
  db.exec(`
    create table if not exists features (
      id text primary key,
      title text not null,
      problem_statement text not null default '',
      contract_text text not null default '',
      status text not null,
      loop_phase text not null,
      completion_criteria text not null default '',
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
    create table if not exists events (
      id text primary key,
      event_type text not null,
      entity_type text not null,
      entity_id text not null,
      payload_json text not null,
      created_at text not null
    );
  `);
}
