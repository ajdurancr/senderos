import { expect, test } from 'bun:test';
import { mapGoalRow, mapRunAttemptRow } from './mappers';

test('mappers translate goal and attempt columns to domain records', () => {
  expect(
    mapGoalRow({
      id: 'goal-1',
      project_id: 'project-1',
      title: 'Goal',
      kind: 'bugfix',
      intake_text: 'request',
      spec_text: 'spec',
      status: 'active',
      base_target_branch: 'main',
      branch_name: null,
      pr_url: null,
      pr_number: null,
      created_at: 'a',
      updated_at: 'b',
    })?.projectId,
  ).toBe('project-1');
  expect(
    mapRunAttemptRow({
      id: 'attempt-1',
      run_id: 'run-1',
      attempt_number: 1,
      agent_id: 'agent-1',
      transition_id: null,
      status: 'running',
      execution_objective: 'work',
      harness: 'codex',
      external_session_id: null,
      resume_command: null,
      heartbeat_at: null,
      host_environment_name: null,
      working_path: '/tmp/work',
      working_path_mode: 'new',
      retry_from_attempt_id: null,
      checkpoint: null,
      source_goal_sha: null,
      failure_step: null,
      status_snapshot_json: '{}',
      result_json: '{}',
      failure_summary: null,
      debug_meta_json: '{}',
      started_at: null,
      finished_at: null,
      created_at: 'a',
      updated_at: 'b',
    })?.workingPath,
  ).toBe('/tmp/work');
  expect(mapGoalRow(null)).toBeNull();
});
