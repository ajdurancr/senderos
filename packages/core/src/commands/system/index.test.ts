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
  test('reports doctor failures for missing config and directories', async () => {
    expect((await doctor(tempHome())).ok).toBe(false);
    const home = await initHome();
    const logRoot = resolveRuntime(home).paths.logRoot;
    rmSync(logRoot, { recursive: true, force: true });
    expect((await doctor(home)).issues).toContain(`missing dir:${logRoot}`);
  });
});
test('status aggregates current project and goal state', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (await createGoal({ home, projectId: project.id, title: 'Visible goal' })).id,
    home,
  ))!;
  const result = await status(home);
  expect(result.projects.total).toBe(1);
  expect(result.activeGoalIds).toContain(goal.id);
});
