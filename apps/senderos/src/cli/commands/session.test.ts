import { describe, expect, test } from 'bun:test';
import { handleSession } from './session';
import { approveFeature, createFeature, createSendero, dispatchRun, listAgents } from '../../services/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('session command', () => {
  function setupSession(home: string) {
    const project = createProjectFixture(home);
    const feature = approveFeature(
      createFeature({ home, projectId: project.id, title: 'Session command target', gherkinText: 'Feature: Session command target' }).id,
      home
    )!;
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Session path', goal: 'Session work.' });
    return dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any;
  }

  test('list returns created sessions', () => {
    const home = initHome();
    const started = setupSession(home);
    expect((handleSession('list', [], home) as any[]).map((x) => x.id)).toContain(started.sessionId);
  });

  test('show returns a stored session', () => {
    const home = initHome();
    const started = setupSession(home);
    expect((handleSession('show', ['session', 'show', started.sessionId], home) as any).id).toBe(started.sessionId);
  });

  test('resume returns resume metadata', () => {
    const home = initHome();
    const started = setupSession(home);
    expect((handleSession('resume', ['session', 'resume', started.sessionId], home) as any).resumeCommand).toContain(started.sessionId);
  });

  test('unknown subcommands throw', () => {
    const home = initHome();
    expect(() => handleSession('wat', [], home)).toThrow('Unknown session action');
  });
});
