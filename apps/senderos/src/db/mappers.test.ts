import { describe, expect, test } from 'bun:test';
import { mapFeatureRow, mapProjectRow, mapTaskRow } from './mappers';

describe('db mappers', () => {
  test('return null when project row input is null', () => {
    expect(mapProjectRow(null)).toBeNull();
  });

  test('return null when feature row input is null', () => {
    expect(mapFeatureRow(null)).toBeNull();
  });

  test('return null when task row input is null', () => {
    expect(mapTaskRow(null)).toBeNull();
  });

  test('map project rows into domain records', () => {
    expect(
      mapProjectRow({
        id: 'p',
        name: 'Senderos',
        canonical_path: '/tmp/senderos',
        github_owner: 'ajdurancr',
        github_repo: 'senderos',
        github_remote: 'https://github.com/ajdurancr/senderos.git',
        target_branch: 'main',
        status: 'healthy',
        integration_mode: 'github_pr',
        inferred_commands_json: '{}',
        health_details_json: '{}',
        created_at: 'a',
        updated_at: 'b',
      })?.targetBranch
    ).toBe('main');
  });

  test('map feature rows into domain records', () => {
    expect(
      mapFeatureRow({
        id: 'f',
        project_id: 'p',
        title: 't',
        spec_text: 'spec',
        source_request_text: 'request',
        gherkin_text: 'Feature: test',
        gherkin_meta_json: '{}',
        status: 'awaiting_scenario_approval',
        loop_phase: 'idle',
        base_target_branch: 'main',
        feature_branch_name: null,
        pr_url: null,
        pr_number: null,
        current_workspace_id: null,
        current_run_id: null,
        created_at: 'a',
        updated_at: 'b',
      })?.projectId
    ).toBe('p');
  });

  test('map task rows into domain records', () => {
    expect(
      mapTaskRow({
        id: 't',
        feature_id: 'f',
        name: 'n',
        phase: 'implementation',
        status: 'ready',
        instruction_json: '{}',
        result_json: '{}',
        created_at: 'a',
        updated_at: 'b',
      })?.featureId
    ).toBe('f');
  });
});
