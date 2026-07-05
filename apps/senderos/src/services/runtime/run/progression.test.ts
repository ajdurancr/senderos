import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { approveFeature, createFeature, getFeature } from '../index';
import { dispatchRunPhase, getRun, getSession, getWorkspace, dispatchFeatureRun, dispatchNextFeatureRun } from './index';
import { resolveRuntime } from '../../../config/runtime';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

describe('run state progression', () => {
  function setupFeature(home: string) {
    const project = createProjectFixture(home);
    return approveFeature(
      createFeature({ home, projectId: project.id, title: 'Progress me', gherkinText: 'Feature: Progress me' }).id,
      home
    )!;
  }

  test('dispatchFeatureRun dispatches the current phase', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const first: any = dispatchRunPhase(feature, 'implementation', home);
    const second: any = dispatchFeatureRun(getFeature(feature.id, home)!, home);
    expect(second.run.id).not.toBe(first.run.id);
  });

  test('dispatchNextFeatureRun advances a feature to done', () => {
    const home = initHome();
    const feature = setupFeature(home);
    dispatchRunPhase(feature, 'implementation', home);
    let current = getFeature(feature.id, home)!;
    for (const expected of ['review', 'mutation', 'done'] as const) {
      const result = dispatchNextFeatureRun(current, home);
      expect(getFeature(feature.id, home)?.senderoStep).toBe(expected);
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
    dispatchRunPhase(feature, 'implementation', home);
    let current = getFeature(feature.id, home)!;
    for (let i = 0; i < 3; i++) {
      dispatchNextFeatureRun(current, home);
      current = getFeature(feature.id, home)!;
    }
    expect(getFeature(feature.id, home)?.status).toBe('completed');
    expect((getWorkspace(current.currentWorkspaceId!, home) as any).status).toBe('cleaned');
  });

  test('completion marks the latest session completed in persistence', () => {
    const home = initHome();
    const feature = setupFeature(home);
    dispatchRunPhase(feature, 'implementation', home);
    let current = getFeature(feature.id, home)!;
    for (let i = 0; i < 3; i++) {
      dispatchNextFeatureRun(current, home);
      current = getFeature(feature.id, home)!;
    }
    const db = new Database(resolveRuntime(home).paths.dbPath);
    expect((db.query('select status from sessions order by created_at desc limit 1').get() as any).status).toBe('completed');
    expect((db.query('select status from run_executions order by created_at desc limit 1').get() as any).status).toBe('succeeded');
    db.close();
  });

  test('query helpers can still read the original run and session records', () => {
    const home = initHome();
    const feature = setupFeature(home);
    const first: any = dispatchRunPhase(feature, 'implementation', home);
    expect(getRun(first.run.id, home)).toBeTruthy();
    expect(getSession(first.session.id, home)).toBeTruthy();
  });
});
