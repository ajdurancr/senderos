import { afterAll, expect, test } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.SENDEROS_TEST_RUNTIME_ROOT ?? resolve(import.meta.dirname, '../../../../../.tmp/test-runtime'), `project-data-${crypto.randomUUID()}`);
mkdirSync(root, { recursive: true });
process.env.SENDEROS_DATABASE_URL = `file:${resolve(root, 'projects.db')}`;
afterAll(() => rmSync(root, { recursive: true, force: true }));

test('HTTP project loading scopes operational records and counts while retaining navigation', async () => {
  const { missionControlData } = await import('./server');
  const core = await import('@senderos/core');
  await missionControlData();
  for (const id of ['selected', 'unrelated']) await core.registerExecutionContext({ id, name: `Project data ${id}` });
  const selected = await core.createSenderos({ executionContextId: 'selected' }).commands.projects.create({ name: 'Selected project' });
  const sibling = await core.createSenderos({ executionContextId: 'selected' }).commands.projects.create({ name: 'Sibling project' });
  const unrelated = await core.createSenderos({ executionContextId: 'unrelated' }).commands.projects.create({ name: 'Other context project' });
  const graph = (await core.getSenderoGraph('software-delivery'))!;
  const goals: Awaited<ReturnType<typeof core.createGoal>>[] = [];
  for (const project of [selected, sibling, unrelated]) {
    const goal = await core.createGoal({ projectId: project.id, title: `${project.name} goal`, senderoVersionId: graph.version.id });
    await core.activateGoal(goal.id);
    goals.push(goal);
  }
  const ready = await missionControlData(new Request(`http://studio.local/goals?project=${selected.id}`));
  expect(ready.queue.dispatchable.length).toBeGreaterThan(0);
  expect(ready.queue.dispatchable.every(item => item.goalId === goals[0]!.id)).toBe(true);
  const dispatched = await core.dispatchRun({ goalId: goals[0]!.id });
  await core.dispatchRun({ goalId: goals[2]!.id });
  const complete = await missionControlData();
  for (const path of [`/projects/${selected.id}/goals`, `/goals?project=${selected.id}`, `/goals?context=selected&project=${selected.id}`]) {
    const scoped = await missionControlData(new Request(`http://studio.local${path}`));
    expect(scoped.goals.map(goal => goal.id)).toEqual([goals[0]!.id]);
    expect(scoped.decisions.map(decision => decision.goalId)).toEqual([goals[0]!.id]);
    expect(scoped.activations).toEqual(complete.activations.filter(item => item.goalId === goals[0]!.id));
    expect(scoped.executions).toEqual(complete.executions.filter(item => item.goalId === goals[0]!.id));
    expect(scoped.queue.dispatchable).toEqual(complete.queue.dispatchable.filter(item => item.goalId === goals[0]!.id));
    expect(scoped.runs.map(run => run.id)).toEqual([dispatched.runId]);
    expect(scoped.attempts.map(attempt => attempt.id)).toEqual([dispatched.attemptId]);
    expect(scoped.status.activeAttemptIds).toEqual([dispatched.attemptId]);
    expect(scoped.status.runningRunIds).toEqual([dispatched.runId]);
    expect(scoped.status.activeRuns).toBe(1);
    expect(scoped.status.openGoals).toBe(1);
    expect(scoped.status.projects.total).toBe(1);
    expect(scoped.status.activeGoalIds).toEqual([goals[0]!.id]);
    expect(scoped.projects).toEqual(complete.projects);
  }
  for (const query of [`context=unrelated&project=${selected.id}`, 'project=missing']) {
    const empty = await missionControlData(new Request(`http://studio.local/goals?${query}`));
    expect(empty.goals).toEqual([]);
    expect(empty.executions).toEqual([]);
    expect(empty.decisions).toEqual([]);
    expect(empty.status.openGoals).toBe(0);
    expect(empty.status.projects.total).toBe(0);
    expect(empty.projects).toEqual(complete.projects);
  }
  expect((await missionControlData()).goals).toEqual(complete.goals);
  expect((await missionControlData(new Request('http://studio.local/goals'))).goals).toEqual(complete.goals);
});
