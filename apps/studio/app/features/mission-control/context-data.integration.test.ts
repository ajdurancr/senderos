import { afterAll, expect, test } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.SENDEROS_TEST_RUNTIME_ROOT ?? resolve(import.meta.dirname, '../../../../../.tmp/test-runtime'), `context-data-${crypto.randomUUID()}`);
mkdirSync(root, { recursive: true });
process.env.SENDEROS_DATABASE_URL = `file:${resolve(root, 'contexts.db')}`;
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('HTTP context loading scopes operational records while retaining navigation and complete programmatic inspection', async () => {
  const { missionControlData } = await import('./server');
  const core = await import('@senderos/core');
  await missionControlData();
  for (const id of ['selected', 'unrelated', 'empty']) await core.registerExecutionContext({ id, name: `Context data ${id}` });
  const selected = await core.createSenderos({ executionContextId: 'selected' }).commands.projects.create({ name: 'Selected project' });
  const unrelated = await core.createSenderos({ executionContextId: 'unrelated' }).commands.projects.create({ name: 'Unrelated project' });
  const graph = (await core.getSenderoGraph('software-delivery'))!;
  const selectedGoal = await core.createGoal({ projectId: selected.id, title: 'Selected goal', senderoVersionId: graph.version.id });
  const unrelatedGoal = await core.createGoal({ projectId: unrelated.id, title: 'Unrelated goal', senderoVersionId: graph.version.id });
  await core.activateGoal(selectedGoal.id);
  await core.activateGoal(unrelatedGoal.id);
  const complete = await missionControlData();
  const scoped = await missionControlData(new Request('http://studio.local/goals?context=selected'));
  expect(scoped.goals.map(goal => goal.id)).toEqual([selectedGoal.id]);
  expect(scoped.decisions.map(decision => decision.goalId)).toEqual([selectedGoal.id]);
  expect(scoped.activations).toEqual(complete.activations.filter(item => item.goalId === selectedGoal.id));
  expect(scoped.executions).toEqual(complete.executions.filter(item => item.goalId === selectedGoal.id));
  expect(scoped.queue.dispatchable).toEqual(complete.queue.dispatchable.filter(item => item.goalId === selectedGoal.id));
  expect(scoped.status.openGoals).toBe(1);
  expect(scoped.projects.map(project => project.id)).toEqual([selected.id, unrelated.id]);
  expect(scoped.executionContexts.map(context => context.id)).toEqual(expect.arrayContaining(['selected', 'unrelated', 'empty']));
  expect((await missionControlData(new Request('http://studio.local/goals?context=unrelated'))).goals.map(goal => goal.id)).toEqual([unrelatedGoal.id]);
  for (const context of ['empty', 'missing']) {
    const empty = await missionControlData(new Request(`http://studio.local/goals?context=${context}`));
    expect(empty.goals).toEqual([]);
    expect(empty.decisions).toEqual([]);
    expect(empty.status.openGoals).toBe(0);
    expect(empty.projects).toEqual(scoped.projects);
  }
  expect((await missionControlData()).goals.map(goal => goal.id)).toEqual([selectedGoal.id, unrelatedGoal.id]);
  expect((await missionControlData(new Request('http://studio.local/goals'))).goals.map(goal => goal.id)).toEqual([selectedGoal.id, unrelatedGoal.id]);
});
