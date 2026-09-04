import { describe, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { resolveRuntime } from '../../shared/config';
import { createGoal, activateGoal } from '../goals';
import {
  createProjectFixture,
  initHome,
  tempHome,
} from '../../test-support/runtime';
import { doctor } from './health';
import { status } from './status';
describe('runtime health operations', () => {
  test('reports doctor failures for missing config and directories', () => {
    expect(doctor(tempHome()).ok).toBe(false);
    const home = initHome();
    const logRoot = resolveRuntime(home).paths.logRoot;
    rmSync(logRoot, { recursive: true, force: true });
    expect(doctor(home).issues).toContain(`missing dir:${logRoot}`);
  });
});
test('status aggregates current project and goal state', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = activateGoal(
    createGoal({ home, projectId: project.id, title: 'Visible goal' }).id,
    home,
  )!;
  const result = status(home);
  expect(result.projects.total).toBe(1);
  expect(result.activeGoalIds).toContain(goal.id);
});
