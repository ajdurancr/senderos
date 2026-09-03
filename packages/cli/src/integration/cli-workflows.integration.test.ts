import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { runCli } from '../run';
import { tempHome, tempProjectDir } from '../../../senderos/tests/helpers/runtime';

async function invokeCli(argv: string[]) {
  const output: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values: unknown[]) => output.push(values.join(' '));
  console.error = (...values: unknown[]) => output.push(values.join(' '));

  try {
    await runCli(argv);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return JSON.parse(output.at(-1) ?? '{}');
}

test('the CLI supports a complete project, goal, dispatch, attempt, and cancellation workflow', async () => {
  const home = tempHome();
  const projectPath = tempProjectDir('senderos-cli-workflow');

  expect(
    (await invokeCli(['init', '--home', home, '--harness', 'codex', '--approve']))
      .home,
  ).toBe(home);

  const config = await invokeCli(['config', 'show', '--home', home]);
  expect(config.defaultHarness).toBe('codex');
  expect(
    (await invokeCli(['config', 'get', 'database.kind', '--home', home])).value,
  ).toBe('local');
  expect(
    (await invokeCli(['config', 'set', 'output.format', 'json', '--home', home]))
      .output.format,
  ).toBe('json');

  const project = await invokeCli([
    'project',
    'create',
    '--canonical-path',
    projectPath,
    '--github-owner',
    'acme',
    '--github-repo',
    'workflow',
    '--home',
    home,
  ]);
  expect((await invokeCli(['project', 'list', '--home', home]))).toHaveLength(1);
  expect(
    (await invokeCli(['project', 'show', project.id, '--home', home])).id,
  ).toBe(project.id);
  expect(
    (await invokeCli([
      'project',
      'update',
      project.id,
      '--name',
      'Workflow Project',
      '--target-branch',
      'develop',
      '--home',
      home,
    ])).targetBranch,
  ).toBe('develop');

  const agents = await invokeCli(['agent', 'list', '--home', home]);
  expect(
    (await invokeCli(['agent', 'show', agents[0].id, '--home', home])).id,
  ).toBe(agents[0].id);

  const transition = await invokeCli([
    'transition',
    'create',
    '--source-agent-id',
    agents[0].id,
    '--target-agent-id',
    agents[1].id,
    '--name',
    'Workflow transition',
    '--description',
    'Exercise the complete command path.',
    '--objective',
    'Complete the workflow goal.',
    '--home',
    home,
  ]);
  expect((await invokeCli(['transition', 'list', '--home', home]))).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: transition.id })]),
  );
  expect(
    (await invokeCli([
      'transition',
      'list',
      '--agent-id',
      agents[0].id,
      '--home',
      home,
    ])).map((item: { id: string }) => item.id),
  ).toContain(transition.id);
  expect(
    (await invokeCli(['transition', 'show', transition.id, '--home', home])).id,
  ).toBe(transition.id);

  const goal = await invokeCli([
    'goal',
    'create',
    '--project-id',
    project.id,
    '--title',
    'Exercise every supported CLI operation',
    '--kind',
    'maintenance',
    '--intake-text',
    'Validate the command contract.',
    '--spec-text',
    'Every supported command completes correctly.',
    '--home',
    home,
  ]);
  expect((await invokeCli(['goal', 'list', '--home', home]))).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: goal.id })]),
  );
  expect((await invokeCli(['goal', 'show', goal.id, '--home', home])).id).toBe(
    goal.id,
  );
  expect(
    (await invokeCli([
      'goal',
      'update',
      goal.id,
      '--title',
      'Updated workflow goal',
      '--spec-text',
      'Updated contract.',
      '--home',
      home,
    ])).title,
  ).toBe('Updated workflow goal');
  expect((await invokeCli(['goal', 'activate', goal.id, '--home', home])).status).toBe(
    'active',
  );

  const plan = await invokeCli(['plan', '--goal-status', 'active', '--home', home]);
  const item = plan.find((candidate: { goalId: string }) => candidate.goalId === goal.id);
  expect(item).toBeDefined();

  const run = await invokeCli([
    'run',
    'dispatch',
    '--goal-id',
    item.goalId,
    '--transition-id',
    item.transitionId,
    '--agent-id',
    item.agentId,
    '--working-path',
    projectPath,
    '--home',
    home,
  ]);
  expect((await invokeCli(['run', 'list', '--home', home]))).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: run.runId })]),
  );
  expect((await invokeCli(['run', 'show', run.runId, '--home', home])).id).toBe(
    run.runId,
  );
  expect((await invokeCli(['run', 'state', goal.id, '--home', home])).attempts).toHaveLength(1);

  expect((await invokeCli(['attempt', 'list', '--run-id', run.runId, '--home', home]))).toHaveLength(1);
  expect(
    (await invokeCli(['attempt', 'show', run.attemptId, '--home', home])).workingPath,
  ).toBe(projectPath);
  expect(
    (await invokeCli(['attempt', 'resume', run.attemptId, '--home', home])).attempt.id,
  ).toBe(run.attemptId);

  expect(
    (await invokeCli([
      'attempt',
      'update',
      run.attemptId,
      '--status',
      'failed',
      '--failure-summary',
      'Verification failed',
      '--home',
      home,
    ])).status,
  ).toBe('failed');
  const retryPlan = await invokeCli(['plan', '--goal-status', 'failed', '--home', home]);
  const retry = retryPlan.find((candidate: { goalId: string }) => candidate.goalId === goal.id);
  expect(retry?.previousRunId).toBe(run.runId);
  const retryRun = await invokeCli([
    'run',
    'dispatch',
    '--goal-id',
    retry.goalId,
    '--transition-id',
    retry.transitionId,
    '--agent-id',
    retry.agentId,
    '--previous-run-id',
    run.runId,
    '--home',
    home,
  ]);
  expect(retryRun.previousRunId).toBe(run.runId);
  expect(
    (await invokeCli([
      'attempt',
      'update',
      retryRun.attemptId,
      '--status',
      'succeeded',
      '--result-json',
      '{"validated":true}',
      '--home',
      home,
    ])).status,
  ).toBe('succeeded');

  expect((await invokeCli(['status', '--home', home])).activeGoalIds).toContain(goal.id);
  expect((await invokeCli(['doctor', '--home', home])).ok).toBe(true);
  expect((await invokeCli(['run', 'cancel', retryRun.runId, '--home', home])).status).toBe(
    'canceled',
  );
  expect((await invokeCli(['goal', 'cancel', goal.id, '--home', home])).status).toBe(
    'canceled',
  );

  const skillPath = join(home, 'operator', 'SKILL.md');
  expect(
    (await invokeCli([
      'bootstrap-agent-skill',
      '--path',
      skillPath,
      '--home',
      home,
      '--harness',
      'codex',
    ])).created,
  ).toBe(true);
  expect(existsSync(skillPath)).toBe(true);
}, 30_000);
