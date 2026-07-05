import { describe, expect, test } from 'bun:test';
import { handleSystemCommand } from './system';
import { approveFeature, createFeature } from '../../services/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';
import { openRuntimeDb } from '../../db/client';

describe('system commands', () => {
  test('doctor reports runtime health', () => {
    const home = initHome();
    expect((handleSystemCommand('doctor', home) as any).database.kind).toBe('local');
  });

  test('status reports runtime summary', () => {
    const home = initHome();
    expect((handleSystemCommand('status', home) as any).openFeatures).toBe(0);
  });

  test('status reports stale sessions and orphaned workspaces without mutating them', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Status target', gherkinText: 'Feature: Status target' }).id, home)!;
    const db = openRuntimeDb(home);
    db.prepare("insert into workspaces (id,feature_id,run_id,session_id,root_path,status,branch_name,retention_reason,created_at,updated_at) values ('ws-orphan',?,?,?,?,?,?,?,?,?)")
      .run(feature.id, null, null, '/tmp/ws-orphan', 'locked', null, null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    db.prepare("insert into sessions (id,run_id,harness,external_session_id,status,status_snapshot_json,heartbeat_at,resume_command,created_at,updated_at) values ('sess-stale',?,?,?,?,?,?,?,?,?)")
      .run(null, 'codex', null, 'stale', '{}', null, null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    db.close();

    const result: any = handleSystemCommand('status', home);
    expect(result.staleSessionIds).toContain('sess-stale');
    expect(result.orphanedWorkspaceIds).toContain('ws-orphan');
  });

  test('unknown commands throw', () => {
    const home = initHome();
    expect(() => handleSystemCommand('wat', home)).toThrow('Unknown command: wat');
  });
});
