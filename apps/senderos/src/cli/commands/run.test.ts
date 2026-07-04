import { describe, expect, test } from 'bun:test';

import { handleRun } from './run';
import { approveFeature, createFeature, listAgents, listSenderosForAgent } from '../../services/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('run command', () => {
  function setupFeature(home: string) {
    const project = createProjectFixture(home);
    return approveFeature(
      createFeature({ home, projectId: project.id, title: 'Run command target', gherkinText: 'Feature: Run command target' }).id,
      home
    )!;
  }

  test('start dispatches a run and accepts sendero/agent overrides', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const agent = listAgents(home)[0]!;
    const sendero = listSenderosForAgent(agent.id, home)[0]!;

    const started: any = handleRun(
      'start',
      [],
      { 'feature-id': feature.id, 'agent-id': agent.id, 'sendero-id': sendero.id },
      home
    );

    expect(started.run).toBeTruthy();
    expect(started.agentRun.agentId).toBe(agent.id);
    expect(started.agentRun.senderoId).toBe(sendero.id);
  });

  test('implicit run invocation starts when feature-id is provided', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = handleRun(undefined, [], { 'feature-id': feature.id }, home);
    expect(started.run).toBeTruthy();
  });

  test('list returns created runs', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = handleRun('start', [], { 'feature-id': feature.id }, home);
    expect((handleRun('list', [], {}, home) as any[]).map((x) => x.id)).toContain(started.run.id);
  });

  test('state returns current feature run state', () => {
    const home = initHome();
    const feature = setupFeature(home);
    handleRun('start', [], { 'feature-id': feature.id }, home);
    const state: any = handleRun('state', [], { 'feature-id': feature.id }, home);
    expect(state.feature.id).toBe(feature.id);
    expect(state.currentAgentRun).toBeTruthy();
  });

  test('advance moves the feature forward', () => {
    const home = initHome();
    const feature = setupFeature(home);
    handleRun('start', [], { 'feature-id': feature.id }, home);
    const advanced: any = handleRun('advance', [], { 'feature-id': feature.id }, home);
    expect(advanced.feature).toBeTruthy();
  });

  test('show returns a stored run', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = handleRun('start', [], { 'feature-id': feature.id }, home);
    expect((handleRun('show', ['run', 'show', started.run.id], {}, home) as any).id).toBe(started.run.id);
  });

  test('cancel marks a run canceled', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const started: any = handleRun('start', [], { 'feature-id': feature.id }, home);
    expect((handleRun('cancel', ['run', 'cancel', started.run.id], {}, home) as any).status).toBe('canceled');
  });

  test('unknown subcommands throw', () => {
    const home = initHome();
    expect(() => handleRun('wat', [], {}, home)).toThrow('Unknown run action');
  });
});
