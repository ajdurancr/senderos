import { describe, expect, test } from 'bun:test';

import { handleRun } from './run';
import { approveFeature, createFeature, createSendero, listAgents } from '../../services/runtime';
import { openRuntimeDb } from '../../db/client';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('run command', () => {
  function setupFeature(home: string) {
    const project = createProjectFixture(home);
    return approveFeature(
      createFeature({ home, projectId: project.id, title: 'Run command target', gherkinText: 'Feature: Run command target' }).id,
      home
    )!;
  }

  test('dispatch creates a run from explicit ids', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Dispatch path', goal: 'Dispatch work.' });

    const dispatched: any = handleRun(
      'dispatch',
      [],
      { 'feature-id': feature.id, 'agent-id': agent.id, 'sendero-id': sendero.id },
      home
    );

    expect(dispatched.runId).toBeTruthy();
    expect(dispatched.sessionId).toBeTruthy();
    expect(dispatched.previousRunId).toBeNull();
  });

  test('dispatch retries a failed run when previous-run-id is supplied', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Retry path', goal: 'Retry work.' });
    const first: any = handleRun('dispatch', [], { 'feature-id': feature.id, 'agent-id': agent.id, 'sendero-id': sendero.id }, home);

    const db = openRuntimeDb(home);
    db.prepare("update runs set status='failed', updated_at=datetime('now') where id=?").run(first.runId);
    db.prepare("update sessions set status='failed', updated_at=datetime('now') where run_id=?").run(first.runId);
    db.prepare("update features set status='failed', updated_at=datetime('now') where id=?").run(feature.id);
    db.close();

    const retried: any = handleRun(
      'dispatch',
      [],
      { 'feature-id': feature.id, 'agent-id': agent.id, 'sendero-id': sendero.id, 'previous-run-id': first.runId },
      home
    );

    expect(retried.previousRunId).toBe(first.runId);
    expect(retried.runId).toBeTruthy();
    expect(retried.runId).not.toBe(first.runId);
  });

  test('list returns created runs', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'List path', goal: 'List work.' });
    const dispatched: any = handleRun('dispatch', [], { 'feature-id': feature.id, 'agent-id': agent.id, 'sendero-id': sendero.id }, home);
    expect((handleRun('list', [], {}, home) as any[]).map((x) => x.id)).toContain(dispatched.runId);
  });

  test('state returns current run state for a feature', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'State path', goal: 'State work.' });
    handleRun('dispatch', [], { 'feature-id': feature.id, 'agent-id': agent.id, 'sendero-id': sendero.id }, home);
    const state: any = handleRun('state', [], { 'feature-id': feature.id }, home);
    expect(state.feature.id).toBe(feature.id);
    expect(state.currentRunExecution).toBeTruthy();
  });

  test('show returns a stored run', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Show path', goal: 'Show work.' });
    const dispatched: any = handleRun('dispatch', [], { 'feature-id': feature.id, 'agent-id': agent.id, 'sendero-id': sendero.id }, home);
    expect((handleRun('show', ['run', 'show', dispatched.runId], {}, home) as any).id).toBe(dispatched.runId);
  });

  test('cancel marks a run canceled', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Cancel path', goal: 'Cancel work.' });
    const dispatched: any = handleRun('dispatch', [], { 'feature-id': feature.id, 'agent-id': agent.id, 'sendero-id': sendero.id }, home);
    expect((handleRun('cancel', ['run', 'cancel', dispatched.runId], {}, home) as any).status).toBe('canceled');
  });

  test('unknown subcommands throw', () => {
    const home = initHome();
    expect(() => handleRun('wat', [], {}, home)).toThrow('Unknown run action');
  });
});
