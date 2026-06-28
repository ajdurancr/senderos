import { afterEach, describe, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';

import { localSqliteAdapter } from '../adapters/db/local-sqlite';
import {
  describeCurrentDb,
  healthcheckCurrentDb,
  openConfiguredCommandDb,
  resolveConfiguredDbAdapter,
  resolveDbAdapter,
} from '../db/client';
import { mapFeatureRow, mapTaskRow } from '../db/mappers';
import { migrate } from '../db/schema';
import { emitEvent } from '../services/events';
import { initHome, tempHome, tursoConfigForHome } from '../../tests/helpers/runtime';

const createClient = mock(() => ({ closed: false }));
mock.module('@libsql/client', () => ({ createClient }));

afterEach(() => {
  createClient.mockClear();
});

describe('database adapters and helpers', () => {
  test('uses the local sqlite adapter for configured local runtimes', () => {
    const home = initHome();

    expect(resolveDbAdapter('local')).toBe(localSqliteAdapter);
    expect(resolveConfiguredDbAdapter(home)).toBe(localSqliteAdapter);
    expect(describeCurrentDb(home)).toEqual({
      kind: 'local',
      dbPath: `${home}/senderos.db`,
    });
    expect(healthcheckCurrentDb(home)).toEqual({ ok: true, issues: [] });

    const db = openConfiguredCommandDb(home);
    expect(db.query("select name from sqlite_master where type='table' and name='features'").get())
      .toBeTruthy();
    db.close();
  });

  test('reports local adapter healthcheck failures when runtime config is missing', () => {
    const health = localSqliteAdapter.healthcheck(tempHome());
    expect(health.ok).toBe(false);
    expect(health.issues[0]).toContain('config.json');
  });

  test('describes, validates, and rejects direct command execution for turso runtimes', async () => {
    const home = tempHome();
    process.env.SENDEROS_TURSO_TOKEN = 'top-secret';

    const { initializeRuntime } = await import('../config/runtime');
    initializeRuntime(home, tursoConfigForHome(home));

    const { tursoAdapter } = await import('../adapters/db/turso');

    expect(resolveDbAdapter('turso')).toBe(tursoAdapter);
    expect(tursoAdapter.describe(home)).toEqual({
      kind: 'turso',
      url: 'libsql://senderos.example.turso.io',
      authTokenEnv: 'SENDEROS_TURSO_TOKEN',
    });

    const healthy = tursoAdapter.healthcheck(home);
    expect(healthy.ok).toBe(true);
    expect(healthy.issues).toEqual([]);
    expect(healthy.warnings).toEqual([]);
    expect(createClient).toHaveBeenCalledWith({
      url: 'libsql://senderos.example.turso.io',
      authToken: 'top-secret',
    });

    createClient.mockImplementationOnce(() => {
      throw new Error('bad token');
    });
    expect(tursoAdapter.healthcheck(home)).toEqual({
      ok: false,
      issues: ['bad token'],
      warnings: [],
    });

    delete process.env.SENDEROS_TURSO_TOKEN;
    expect(tursoAdapter.healthcheck(home)).toEqual({
      ok: true,
      issues: [],
      warnings: ['env:SENDEROS_TURSO_TOKEN is not set in this shell'],
    });

    const commandDb = () => openConfiguredCommandDb(home);
    expect(commandDb).toThrow(
      'Turso is configured through the built-in adapter layer, but command execution has not been migrated to the async libsql execution path yet.'
    );
  });

  test('maps database rows and writes schema-backed events', () => {
    const db = new Database(':memory:');
    migrate(db);

    expect(mapFeatureRow(null)).toBeNull();
    expect(
      mapFeatureRow({
        id: 'feature-1',
        title: 'Title',
        problem_statement: 'Problem',
        contract_text: 'Contract',
        status: 'defined',
        loop_phase: 'idle',
        completion_criteria: 'Done',
        current_workspace_id: null,
        current_run_id: null,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      })
    ).toEqual({
      id: 'feature-1',
      title: 'Title',
      problemStatement: 'Problem',
      contractText: 'Contract',
      status: 'defined',
      loopPhase: 'idle',
      completionCriteria: 'Done',
      currentWorkspaceId: null,
      currentRunId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(mapTaskRow(null)).toBeNull();
    expect(
      mapTaskRow({
        id: 'task-1',
        feature_id: 'feature-1',
        name: 'contract task',
        phase: 'contract',
        status: 'ready',
        instruction_json: '{}',
        result_json: '{}',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      })
    ).toEqual({
      id: 'task-1',
      featureId: 'feature-1',
      name: 'contract task',
      phase: 'contract',
      status: 'ready',
      instructionJson: '{}',
      resultJson: '{}',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });

    emitEvent(db, 'feature.created', 'feature', 'feature-1', { ok: true });
    expect(db.query('select event_type, payload_json from events').get()).toEqual({
      event_type: 'feature.created',
      payload_json: '{"ok":true}',
    });

    db.close();
  });
});
