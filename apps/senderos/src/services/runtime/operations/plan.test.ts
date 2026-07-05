import { describe, expect, test } from 'bun:test';
import { openRuntimeDb } from '../../../db/client';
import { approveFeature, createFeature, createSendero, listAgents } from '../index';
import { dispatchRun } from './runs';
import { plan } from './plan';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

function setupFeature(home: string, status: 'active' | 'failed' = 'active') {
  const project = createProjectFixture(home);
  const feature = approveFeature(
    createFeature({ home, projectId: project.id, title: `Feature ${status}`, gherkinText: `Feature: ${status}` }).id,
    home
  )!;
  if (status === 'failed') {
    const agent = listAgents(home)[0]!;
    const sendero = createSendero({ home, sourceAgentId: agent.id, name: 'Retry path', goal: 'Retry failed work.' });
    const first = dispatchRun({ featureId: feature.id, senderoId: sendero.id, agentId: agent.id }, home);
    const conn = openRuntimeDb(home);
    conn.prepare("update runs set status='failed', updated_at=datetime('now') where id=?").run(first.runId);
    conn.prepare("update sessions set status='failed', updated_at=datetime('now') where run_id=?").run(first.runId);
    conn.prepare("update features set status='failed', updated_at=datetime('now') where id=?").run(feature.id);
    conn.close();
  }
  return feature;
}

describe('runtime planning operation', () => {
  test('returns only dispatchable items by default', () => {
    const home = initHome();
    const feature = setupFeature(home, 'active');
    const items = plan({ home }) as any[];
    expect(items.some((item) => item.featureId === feature.id)).toBe(true);
    expect(items.every((item) => Object.keys(item).sort().join(',') === 'agentId,featureId,previousRunId,senderoId')).toBe(true);
  });

  test('includes failed features as dispatchable retry candidates', () => {
    const home = initHome();
    const feature = setupFeature(home, 'failed');
    const items = plan({ home }) as any[];
    expect(items.some((item) => item.featureId === feature.id && item.previousRunId)).toBe(true);
  });

  test('scopes planning by repeated feature statuses', () => {
    const home = initHome();
    const active = setupFeature(home, 'active');
    setupFeature(home, 'failed');
    const items = plan({ home, featureStatuses: ['active'] as any }) as any[];
    expect(items.some((item) => item.featureId === active.id)).toBe(true);
  });
});
