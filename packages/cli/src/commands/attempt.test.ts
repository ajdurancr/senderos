import { describe, expect, test } from 'bun:test';

import { handleAttempt } from './attempt';
import { handleHost } from './host';
import { createGoal, activateGoal, dispatchRun, updateRunAttempt } from '@senderos/core';
import { createProjectFixture, initHome } from '../../../core/src/test-support/runtime';

async function createAttemptFixture() {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Attempt fixture' });
  await activateGoal(goal.id, home);
  const run = await dispatchRun({ goalId: goal.id }, home);
  await handleHost('register', ['host', 'register', 'cli-host'], { name: 'CLI host', capability: ['independent_session', 'shell'] }, home);
  await handleHost('grant', ['host', 'grant', 'cli-host'], { 'project-id': project.id, 'workspace-ref': project.id }, home);
  await handleHost('workspace', ['host', 'workspace', 'cli-host'], { 'project-id': project.id, available: true, 'working-path': '/tmp/attempt-work' }, home);
  const claim = await handleAttempt('claim', ['attempt', 'claim', run.attemptId], { 'owner-id': 'cli-host' }, home);
  if (!claim || !('token' in claim)) throw new Error('Expected claim token');
  expect(await handleAttempt('show', ['attempt', 'show', run.attemptId], {}, home)).toMatchObject({ protocolVersion: 2, status: 'queued', startedAt: null });
  await handleAttempt('start', ['attempt', 'start', run.attemptId], { token: claim.token, 'external-session-id': 'host-session-1', 'parent-session-id': 'controller', 'working-path': '/tmp/attempt-work', 'resume-command': 'codex resume abc' }, home);
  const attempt = await updateRunAttempt(run.attemptId, { token: claim.token, resumeCommand: 'codex resume abc' }, home);
  return { home, attempt, token: claim.token };
}

describe('attempt command with strict fresh-runtime host protocol', () => {
  test('list returns all attempts when no run filter is supplied', async () => {
    const { home, attempt, token } = await createAttemptFixture();

    expect(await handleAttempt('list', [], {}, home)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: attempt.id })]),
    );
  });

  test('list filters attempts by run id', async () => {
    const { home, attempt, token } = await createAttemptFixture();

    expect(
      await handleAttempt('list', [], { 'run-id': attempt.runId }, home),
    ).toEqual([expect.objectContaining({ id: attempt.id })]);
  });

  test('show returns a concrete attempt', async () => {
    const { home, attempt, token } = await createAttemptFixture();

    expect(await handleAttempt('show', ['attempt', 'show', attempt.id], {}, home))
      .toMatchObject({ id: attempt.id });
  });

  test('update records execution metadata and a non-terminal status', async () => {
    const { home, attempt, token } = await createAttemptFixture();

    const updated = await handleAttempt(
      'update',
      ['attempt', 'update', attempt.id],
      {
        token,
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
    const { home, attempt, token } = await createAttemptFixture();

    const updated = await handleAttempt(
      'update',
      ['attempt', 'update', attempt.id],
      {
        token,
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
    const { home, attempt, token } = await createAttemptFixture();

    expect(
      (await handleAttempt(
        'resume',
        ['attempt', 'resume', attempt.id],
        {},
        home,
      ))).toMatchObject({ resumeCommand: 'codex resume abc' });
  });

  test('supports the complete host ownership and completion metadata protocol', async () => {
    const { home, attempt, token } = await createAttemptFixture();
    const evidence = await handleAttempt('evidence', ['attempt', 'evidence', attempt.id], { token, kind: 'test', label: 'Passed', url: 'https://example.test/proof' }, home);
    expect(evidence).toMatchObject({ kind: 'test', label: 'Passed' });
    expect(JSON.stringify(evidence)).not.toContain(token);
    const review = await handleAttempt('review', ['attempt', 'review', attempt.id], { status: 'approved', reviewer: 'Tony', rationale: 'Verified' }, home);
    expect(review).toMatchObject({ status: 'approved', reviewer: 'Tony' });
    const claim = await handleAttempt('claim', ['attempt', 'claim', attempt.id], { token, 'owner-id': 'cli-host', 'lease-seconds': '120' }, home);
    expect(claim).toMatchObject({ ownerId: 'cli-host' });
    if (!claim || !("token" in claim)) throw new Error("Expected claim token");
    expect(await handleAttempt('heartbeat', ['attempt', 'heartbeat', attempt.id], { token: claim.token, 'lease-seconds': '120' }, home)).toMatchObject({ cancellationRequested: false });
    expect(await handleAttempt('abandon', ['attempt', 'abandon', attempt.id], { token, 'confirmed-stopped': true, reason: 'Host session ended' }, home)).toMatchObject({ status: 'failed' });
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
