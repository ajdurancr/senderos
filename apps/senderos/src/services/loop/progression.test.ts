import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { approveFeature, createFeature, getFeature } from '../runtime';
import { dispatchForPhase, getRun, getSession, getWorkspace, startLoopForFeature, tickLoopForFeature } from './index';
import { resolveRuntime } from '../../config/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('loop progression', () => {
  test('starts and advances a feature to completion', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const feature = approveFeature(
      createFeature({ home, projectId: project.id, title: 'Progress me', gherkinText: 'Feature: Progress me' }).id,
      home
    )!;
    const first: any = dispatchForPhase(feature, 'implementation', home);
    const second: any = startLoopForFeature(getFeature(feature.id, home)!, home);
    expect(second.run.id).not.toBe(first.run.id);
    let current = getFeature(feature.id, home)!;
    for (const expected of ['review', 'mutation', 'done'] as const) {
      const result = tickLoopForFeature(current, home);
      expect(getFeature(feature.id, home)?.loopPhase).toBe(expected);
      current = getFeature(feature.id, home)!;
      if (expected === 'done') {
        expect(result.run).toBeNull();
        expect(result.task).toBeNull();
      }
    }
    expect(getFeature(feature.id, home)?.status).toBe('completed');
    expect((getWorkspace(current.currentWorkspaceId!, home) as any).status).toBe('released');
    const db = new Database(resolveRuntime(home).paths.dbPath);
    expect((db.query('select status from sessions order by created_at desc limit 1').get() as any).status).toBe('completed');
    db.close();
    expect(getRun(first.run.id, home)).toBeTruthy();
    expect(getSession(first.session.id, home)).toBeTruthy();
  });
});
