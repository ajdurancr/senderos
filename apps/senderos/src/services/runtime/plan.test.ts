import { describe, expect, test } from 'bun:test';
import { openRuntimeDb } from '../../db/client';
import { approveFeature, createFeature, createSendero, listAgents } from './index';
import { dispatchRun } from './run';
import { plan } from './plan';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

function setupFeature(home: string) {
  const project = createProjectFixture(home);
  return approveFeature(
    createFeature({ home, projectId: project.id, title: 'Feature target', gherkinText: 'Feature: target' }).id,
    home
  )!;
}

describe('runtime planning operation', () => {
  test('returns only dispatchable items by default', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const items = plan({ home }) as any[];
    expect(items.some((item) => item.featureId === feature.id)).toBe(true);
    expect(items.every((item) => Object.keys(item).sort().join(',') === 'agentId,featureId,previousRunId,senderoId')).toBe(true);
  });

  test('uses the previous failed run execution as a retry candidate', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Retry path', goal: 'Retry failed work.' });
    const first = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any;

    const conn = openRuntimeDb(home);
    conn.prepare("update runs set status='failed', updated_at=datetime('now') where id=?").run(first.runId);
    conn.prepare("update run_executions set status='failed', updated_at=datetime('now') where run_id=?").run(first.runId);
    conn.prepare("update sessions set status='failed', updated_at=datetime('now') where run_id=?").run(first.runId);
    conn.prepare("update features set status='failed', updated_at=datetime('now') where id=?").run(feature.id);
    conn.close();

    const items = plan({ home }) as any[];
    expect(items.some((item) => item.featureId === feature.id && item.previousRunId === first.runId && item.senderoId === sendero.id)).toBe(true);
  });

  test('uses the next sendero when a previous run succeeded with a target agent', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const [sourceAgent, targetAgent] = listAgents(home) as any[];
    const sourceSendero = createSendero({ home, sourceAgentId: sourceAgent.id, targetAgentId: targetAgent.id, name: 'Forward path', goal: 'Go forward.' });
    const targetSendero = createSendero({ home, sourceAgentId: targetAgent.id, name: 'Next path', goal: 'Do next.' });
    const first = dispatchRun({ featureId: feature.id, senderoId: sourceSendero.id, agentId: sourceAgent.id }, home) as any;

    const conn = openRuntimeDb(home);
    conn.prepare("update runs set status='succeeded', updated_at=datetime('now') where id=?").run(first.runId);
    conn.prepare("update run_executions set status='succeeded', updated_at=datetime('now') where run_id=?").run(first.runId);
    conn.prepare("update sessions set status='completed', updated_at=datetime('now') where run_id=?").run(first.runId);
    conn.close();

    const items = plan({ home }) as any[];
    expect(items.some((item) => item.featureId === feature.id && item.previousRunId === first.runId && item.senderoId === targetSendero.id && item.agentId === targetAgent.id)).toBe(true);
  });

  test('skips runs that are still active and falls back when a current run record is missing', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Running path', goal: 'Still running.' });
    const started = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home) as any;
    expect((plan({ home }) as any[]).some((item) => item.featureId === feature.id)).toBe(false);

    const conn = openRuntimeDb(home);
    conn.prepare('delete from runs where id=?').run(started.runId);
    conn.close();
    expect((plan({ home }) as any[]).some((item) => item.featureId === feature.id)).toBe(false);
  });

  test('scopes planning by repeated feature statuses', () => {
    const home = initHome();
    setupFeature(home);
    const items = plan({ home, featureStatuses: ['active'] as any }) as any[];
    expect(Array.isArray(items)).toBe(true);
  });
});
