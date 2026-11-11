import { afterAll, expect, test, vi } from 'vitest';
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


test('HTTP project loading explains only its goals while preserving filtered records and all navigation', async () => {
  const { missionControlData } = await import('./server');
  const { filterMissionControlData } = await import('./scope-filters');
  const core = await import('@senderos/core');
  const { createClient } = await import('@libsql/client');
  await missionControlData();
  await core.registerExecutionContext({ id: 'project-query', name: 'Project query fixture' });
  const senderos = core.createSenderos({ executionContextId: 'project-query' });
  const selected = await senderos.commands.projects.create({ name: 'Query selected' });
  const unrelated = await senderos.commands.projects.create({ name: 'Query unrelated' });
  const graph = (await core.getSenderoGraph('software-delivery'))!;
  for (const project of [selected, unrelated]) {
    const goal = await core.createGoal({ projectId: project.id, title: project.name, senderoVersionId: graph.version.id });
    await core.activateGoal(goal.id);
    const item = (await senderos.commands.plan()).find(item => item.goalId === goal.id)!;
    await senderos.commands.runs.dispatch({ ...item, previousRunId: item.previousRunId ?? undefined });
  }
  const complete = await missionControlData();
  const expected = filterMissionControlData(complete, 'project-query', selected.id);
  const client = createClient({ url: process.env.SENDEROS_DATABASE_URL! });
  const prototype = Object.getPrototypeOf(client);
  const execute = prototype.execute;
  let explanations = 0;
  let inspectedSelects = 0;
  const unrelatedIds = complete.goals.filter(item => item.projectId === unrelated.id).flatMap(goal => [goal.id, ...complete.runs.filter(run => run.goalId === goal.id).flatMap(run => [run.id, ...complete.attempts.filter(attempt => attempt.runId === run.id).map(attempt => attempt.id)])]);
  const materializedUnrelated = new Set<string>();
  const spy = vi.spyOn(prototype, 'execute').mockImplementation(async function(this: unknown, statement: unknown, ...args: unknown[]) {
    if (statement === 'BEGIN IMMEDIATE') explanations++;
    const result = await execute.call(this, statement, ...args);
    const sql = typeof statement === 'string' ? statement : (statement as { sql?: string }).sql ?? '';
    if (/from "(goals|runs|run_attempts)"/.test(sql)) {
      inspectedSelects++;
      const serialized = JSON.stringify(result.rows);
      for (const id of unrelatedIds) if (serialized.includes(id)) materializedUnrelated.add(id);
    }
    return result;
  });
  let actual;
  try { actual = await missionControlData(new Request(`http://studio.local/goals?context=project-query&project=${selected.id}`)); }
  finally { spy.mockRestore(); client.close(); }
  for (const key of ['goals', 'runs', 'attempts', 'activations', 'executions', 'decisions', 'queue', 'status'] as const) expect(actual[key]).toEqual(expected[key]);
  expect(actual.projects).toEqual(complete.projects);
  expect(actual.executionContexts).toEqual(complete.executionContexts);
  expect(explanations).toBe(expected.goals.length);
  expect(inspectedSelects).toBeGreaterThan(0);
  expect([...materializedUnrelated]).toEqual([]);
  for (const suffix of [`project=missing`, `context=unrelated&project=${selected.id}`]) {
    const empty = await missionControlData(new Request(`http://studio.local/goals?${suffix}`));
    expect(empty.goals).toEqual([]);
    expect(empty.decisions).toEqual([]);
    expect(empty.queue.dispatchable).toEqual([]);
    expect(empty.status.openGoals).toBe(0);
    expect(empty.projects).toEqual(complete.projects);
  }
  const pathScoped = await missionControlData(new Request(`http://studio.local/projects/${selected.id}/goals`));
  expect(pathScoped.goals).toEqual(expected.goals);
  expect((await missionControlData()).goals).toEqual(complete.goals);
});
