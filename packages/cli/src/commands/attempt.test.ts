import { describe, expect, test } from 'bun:test';

import { handleAttempt } from './attempt';
import { createGoal, createRunAttempt, createRunRecord, getAgentBySlug } from '@senderos/core';
import { createProjectFixture, initHome } from '../../../core/src/test-support/runtime';

async function createAttemptFixture() {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Attempt fixture' });
  const run = (await createRunRecord(goal, home))!;
  const agent = (await getAgentBySlug('spec-partner', home))!;
  const attempt = await createRunAttempt({
    home,
    runId: run.id,
    attemptNumber: 1,
    agentId: agent.id,
    executionObjective: 'Execute work.',
    harness: 'codex',
    resumeCommand: 'codex resume abc',
  });
  return { home, attempt };
}

describe('attempt command', () => {
  test('list returns all attempts when no run filter is supplied', async () => {
    const { home, attempt } = await createAttemptFixture();

    expect(await handleAttempt('list', [], {}, home)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: attempt.id })]),
    );
  });

  test('list filters attempts by run id', async () => {
    const { home, attempt } = await createAttemptFixture();

    expect(
      await handleAttempt('list', [], { 'run-id': attempt.runId }, home),
    ).toEqual([expect.objectContaining({ id: attempt.id })]);
  });

  test('show returns a concrete attempt', async () => {
    const { home, attempt } = await createAttemptFixture();

    expect(await handleAttempt('show', ['attempt', 'show', attempt.id], {}, home))
      .toMatchObject({ id: attempt.id });
  });

  test('update records execution metadata and a non-terminal status', async () => {
    const { home, attempt } = await createAttemptFixture();

    const updated = await handleAttempt(
      'update',
      ['attempt', 'update', attempt.id],
      {
        status: 'paused',
        checkpoint: 'waiting-for-review',
        'working-path': '/tmp/attempt-work',
        'external-session-id': 'host-session-1',
        'resume-command': 'codex resume host-session-1',
      },
      home,
    );

    expect(updated).toMatchObject({
      status: 'paused',
      checkpoint: 'waiting-for-review',
      workingPath: '/tmp/attempt-work',
      externalSessionId: 'host-session-1',
    });
  });

  test('update finalizes a failed attempt and parses its result payload', async () => {
    const { home, attempt } = await createAttemptFixture();

    const updated = await handleAttempt(
      'update',
      ['attempt', 'update', attempt.id],
      {
        status: 'failed',
        'failure-step': 'verification',
        'failure-summary': 'A required check failed.',
        'result-json': '{"validated":false}',
      },
      home,
    );

    expect(updated).toMatchObject({
      status: 'failed',
      failureStep: 'verification',
      resultJson: '{"validated":false}',
    });
  });

  test('resume returns the persisted host resume instruction', async () => {
    const { home, attempt } = await createAttemptFixture();

    expect(
      (await handleAttempt(
        'resume',
        ['attempt', 'resume', attempt.id],
        {},
        home,
      ))).toMatchObject({ resumeCommand: 'codex resume abc' });
  });

  test('rejects unknown actions and missing attempt ids', async () => {
    const { home } = await createAttemptFixture();

    await expect(handleAttempt('invalid-action', [], {}, home)).rejects.toThrow(
      'Unknown attempt action',
    );
    await expect(
      handleAttempt('show', ['attempt', 'show'], {}, home),
    ).rejects.toThrow('Missing required argument: attempt id');
  });
});
