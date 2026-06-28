import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';

import {
  defaultInstruction,
  dispatchForPhase,
  ensurePhaseTask,
  getRun,
  getSession,
  getTask,
  getWorkspace,
  listTasks,
  startLoopForFeature,
  tickLoopForFeature,
  updateTaskStatus,
} from './index';
import { createFeature, getFeature } from '../runtime';
import { resolveRuntime } from '../../config/runtime';
import { initHome } from '../../../tests/helpers/runtime';

describe('loop services', () => {
  test('builds phase-specific instructions', () => {
    const feature = {
      id: 'feature-1',
      title: 'Title',
      problemStatement: '',
      contractText: '',
      status: 'defined',
      loopPhase: 'idle',
      completionCriteria: '',
      currentWorkspaceId: null,
      currentRunId: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as const;

    expect(defaultInstruction(feature, 'contract').objective).toContain('acceptance criteria');
    expect(defaultInstruction(feature, 'implementation').objective).toContain('TDD loop');
    expect(defaultInstruction(feature, 'review').objective).toContain('mutation testing');
    expect(defaultInstruction(feature, 'mutation').objective).toContain('mutation-confidence');
    expect(defaultInstruction(feature, 'done').objective).toBe('No further work required.');
  });

  test('creates, reuses, and updates tasks directly', () => {
    const home = initHome();
    const feature = createFeature({ home, title: 'Task plumbing' });

    const contractTask = ensurePhaseTask(feature, 'contract', home);
    const sameTask = ensurePhaseTask(feature, 'contract', home);
    const implementationTask = ensurePhaseTask(feature, 'implementation', home);

    expect(sameTask.id).toBe(contractTask.id);
    expect(implementationTask.status).toBe('pending');

    updateTaskStatus(contractTask.id, 'running', { dispatched: true }, home);
    expect(getTask(contractTask.id, home)).toMatchObject({
      id: contractTask.id,
      status: 'running',
      resultJson: '{"dispatched":true}',
    });

    expect(listTasks(feature.id, home)).toHaveLength(2);
  });

  test('dispatches phases, allocates workspaces, and advances a feature to completion', () => {
    const home = initHome();
    const feature = createFeature({ home, title: 'Dispatch me' });

    const firstDispatch = dispatchForPhase(feature, 'contract', home) as any;
    expect(firstDispatch.run?.status).toBe('running');
    expect(firstDispatch.session?.status).toBe('active');
    expect(firstDispatch.task?.status).toBe('running');

    const featureAfterFirstDispatch = getFeature(feature.id, home)!;
    const workspace = getWorkspace(featureAfterFirstDispatch.currentWorkspaceId!, home) as any;
    expect(workspace.status).toBe('locked');

    const refreshedFeature = featureAfterFirstDispatch;
    const secondDispatch = startLoopForFeature(refreshedFeature, home) as any;
    expect(secondDispatch.run?.id).not.toBe(firstDispatch.run?.id);
    expect((getWorkspace(getFeature(feature.id, home)!.currentWorkspaceId!, home) as any).id).toBe(
      workspace.id
    );

    let current = getFeature(feature.id, home)!;
    for (const expected of ['implementation', 'review', 'mutation', 'done'] as const) {
      const result = tickLoopForFeature(current, home);
      expect(getFeature(feature.id, home)?.loopPhase).toBe(expected);
      current = getFeature(feature.id, home)!;

      if (expected !== 'done') {
        expect(result.run).toBeTruthy();
        expect(result.task).toBeTruthy();
      } else {
        expect(result.run).toBeNull();
        expect(result.task).toBeNull();
      }
    }

    expect(getFeature(feature.id, home)?.status).toBe('completed');
    expect((getWorkspace(current.currentWorkspaceId!, home) as any).status).toBe('released');

    const db = new Database(resolveRuntime(home).paths.dbPath);
    const completedSession = db
      .query('select status from sessions order by created_at desc limit 1')
      .get() as any;
    expect(completedSession.status).toBe('completed');
    db.close();

    expect(getRun(firstDispatch.run.id, home)).toBeTruthy();
    expect(getSession(firstDispatch.session.id, home)).toBeTruthy();
  });
});
