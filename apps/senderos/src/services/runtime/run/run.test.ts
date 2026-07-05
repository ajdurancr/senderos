import { describe, expect, test } from 'bun:test';
import { openRuntimeDb } from '../../../db/client';
import { approveFeature, createFeature, createSendero, getFeature, listAgents } from '../index';
import { cancelRun, dispatchRun, listRuns, listSessions, resumeSession, showRunState } from './run';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('runtime run operations', () => {
  function setupRunFixture(home: string) {
    const project = createProjectFixture(home);
    const feature = approveFeature(
      createFeature({ home, projectId: project.id, title: 'Run target', gherkinText: 'Feature: Run target' }).id,
      home
    )!;
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Runtime path', goal: 'Dispatch runtime work.' });
    return { feature, agent, sendero };
  }

  test('listRuns returns created runs', () => {
    const home = initHome();
    const { feature, agent, sendero } = setupRunFixture(home);
    const started = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any;
    expect(listRuns(home).map((x: any) => x.id)).toContain(started.runId);
  });

  test('listSessions returns created sessions', () => {
    const home = initHome();
    const { feature, agent, sendero } = setupRunFixture(home);
    const started = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any;
    expect(listSessions(home).map((x: any) => x.id)).toContain(started.sessionId);
  });

  test('showRunState returns current run state', () => {
    const home = initHome();
    const { feature, agent, sendero } = setupRunFixture(home);
    const started = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any;
    const state: any = showRunState(feature.id, home);
    expect(state.currentRun.id).toBe(started.runId);
    expect(state.currentRunExecution.runId).toBe(started.runId);
  });

  test('dispatchRun rejects invalid feature ids and mismatched previous run ids', () => {
    const home = initHome();
    expect(() => dispatchRun({ featureId: 'missing', senderoId: 's', agentId: 'a' }, home)).toThrow();

    const { feature, agent, sendero } = setupRunFixture(home);
    dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home);
    expect(() => dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id, previousRunId: 'wrong' }, home)).toThrow();
  });

  test('dispatchRun rejects previous-run-id on first dispatch', () => {
    const home = initHome();
    const { feature, agent, sendero } = setupRunFixture(home);
    expect(() => dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id, previousRunId: 'x' }, home)).toThrow();
  });

  test('dispatchRun can retry failed runs and advance succeeded runs', () => {
    const home = initHome();
    const { feature, agent, sendero } = setupRunFixture(home);
    const started = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any;

    const db = openRuntimeDb(home);
    db.prepare("update runs set status='failed', updated_at=datetime('now') where id=?").run(started.runId);
    db.prepare("update sessions set status='failed', updated_at=datetime('now') where run_id=?").run(started.runId);
    db.prepare("update features set status='failed', updated_at=datetime('now') where id=?").run(feature.id);
    db.close();

    const retried = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id, previousRunId: started.runId }, home) as any;
    expect(retried.previousRunId).toBe(started.runId);
    expect(retried.runId).not.toBe(started.runId);

    const db2 = openRuntimeDb(home);
    db2.prepare("update runs set status='succeeded', updated_at=datetime('now') where id=?").run(retried.runId);
    db2.prepare("update sessions set status='completed', updated_at=datetime('now') where run_id=?").run(retried.runId);
    db2.close();

    const advanced = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id, previousRunId: retried.runId }, home) as any;
    expect(advanced.previousRunId).toBe(retried.runId);
  });

  test('dispatchRun rejects canceled runs and missing current run records', () => {
    const home = initHome();
    const { feature, agent, sendero } = setupRunFixture(home);
    const started = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any;

    const db = openRuntimeDb(home);
    db.prepare("update runs set status='canceled', updated_at=datetime('now') where id=?").run(started.runId);
    db.close();
    expect(() => dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id, previousRunId: started.runId }, home)).toThrow();

    const home2 = initHome();
    const fixture2 = setupRunFixture(home2);
    const started2 = dispatchRun({ featureId: fixture2.feature.id, senderoId: fixture2.sendero.id, agentId: fixture2.agent.id }, home2) as any;
    const db3 = openRuntimeDb(home2);
    db3.prepare('delete from runs where id=?').run(started2.runId);
    db3.close();
    expect(() => dispatchRun({ featureId: fixture2.feature.id, senderoId: fixture2.sendero.id, agentId: fixture2.agent.id, previousRunId: started2.runId }, home2)).toThrow();
  });

  test('cancelRun marks the run canceled and cancels the feature', () => {
    const home = initHome();
    const { feature, agent, sendero } = setupRunFixture(home);
    const started = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any;
    expect((cancelRun(started.runId, home) as any).status).toBe('canceled');
    expect(getFeature(feature.id, home)?.status).toBe('canceled');
  });

  test('cancelRun, showRunState, and resumeSession throw for missing records', () => {
    const home = initHome();
    expect(() => cancelRun('missing', home)).toThrow();
    expect(() => showRunState('missing', home)).toThrow();
    expect(() => resumeSession('missing', home)).toThrow();
  });
});
