import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { approveFeature, createFeature, getFeature } from '../runtime';
import { dispatchForPhase, getRun, getSession, getWorkspace, startLoopForFeature, tickLoopForFeature } from './index';
import { resolveRuntime } from '../../config/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('loop progression', () => {
  function setupFeature(home: string) {
    const project = createProjectFixture(home);
    return approveFeature(
      createFeature({ home, projectId: project.id, title: 'Progress me', gherkinText: 'Feature: Progress me' }).id,
      home
    )!;
  }

  test('startLoopForFeature dispatches the current phase', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const first: any = dispatchForPhase(feature, 'implementation', home);
    const second: any = startLoopForFeature(getFeature(feature.id, home)!, home);
    expect(second.run.id).not.toBe(first.run.id);
  });

  test('tickLoopForFeature advances a feature to done', () => {
    const home = initHome();
    const feature = setupFeature(home);
    dispatchForPhase(feature, 'implementation', home);
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
  });

  test('completion marks the feature completed and cleans the workspace', () => {
    const home = initHome();
    const feature = setupFeature(home);
    dispatchForPhase(feature, 'implementation', home);
    let current = getFeature(feature.id, home)!;
    for (let i = 0; i < 3; i++) {
      tickLoopForFeature(current, home);
      current = getFeature(feature.id, home)!;
    }
    expect(getFeature(feature.id, home)?.status).toBe('completed');
    expect((getWorkspace(current.currentWorkspaceId!, home) as any).status).toBe('cleaned');
  });

  test('completion marks the latest session completed in persistence', () => {
    const home = initHome();
    const feature = setupFeature(home);
    dispatchForPhase(feature, 'implementation', home);
    let current = getFeature(feature.id, home)!;
    for (let i = 0; i < 3; i++) {
      tickLoopForFeature(current, home);
      current = getFeature(feature.id, home)!;
    }
    const db = new Database(resolveRuntime(home).paths.dbPath);
    expect((db.query('select status from sessions order by created_at desc limit 1').get() as any).status).toBe('completed');
    db.close();
  });

  test('query helpers can still read the original run and session records', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const first: any = dispatchForPhase(feature, 'implementation', home);
    expect(getRun(first.run.id, home)).toBeTruthy();
    expect(getSession(first.session.id, home)).toBeTruthy();
  });
});
