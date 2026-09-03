import { expect, test } from 'bun:test';
import { createRunRecord, getRun, latestRunForGoal } from './dispatch';
import { activateGoal, createGoal } from '../index';
import { createProjectFixture, initHome } from '../../../../tests/helpers/runtime';

test('run dispatch persistence creates and retrieves a run for a goal', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = activateGoal(createGoal({ home, projectId: project.id, title: 'Dispatch persistence' }).id, home)!;
  const run: any = createRunRecord(goal, home);
  expect((getRun(run.id, home) as any).id).toBe(run.id);
  expect((latestRunForGoal(goal.id, home) as any).id).toBe(run.id);
});
