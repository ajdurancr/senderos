import { describe, expect, test } from 'bun:test';
import { approveFeature, createFeature, createSendero, getFeature, listAgents } from '../index';
import { cancelRun, dispatchRun, listRuns, listSessions } from './index';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('runtime run operations', () => {
  function setupStartedRun(home: string) {
    const project = createProjectFixture(home);
    const feature = approveFeature(createFeature({ home, projectId: project.id, title: 'Run target', gherkinText: 'Feature: Run target' }).id, home)!;
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Runtime path', goal: 'Dispatch runtime work.' });
    return { feature, started: dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any };
  }

  test('listRuns returns created runs', () => {
    const home = initHome();
    const { started } = setupStartedRun(home);
    expect(listRuns(home).map((x: any) => x.id)).toContain(started.runId);
  });

  test('listSessions returns created sessions', () => {
    const home = initHome();
    const { started } = setupStartedRun(home);
    expect(listSessions(home).map((x: any) => x.id)).toContain(started.sessionId);
  });

  test('cancelRun marks the run canceled and cancels the feature', () => {
    const home = initHome();
    const { feature, started } = setupStartedRun(home);
    expect((cancelRun(started.runId, home) as any).status).toBe('canceled');
    expect(getFeature(feature.id, home)?.status).toBe('canceled');
  });
});
