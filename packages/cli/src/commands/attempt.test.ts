import { describe, expect, test } from 'bun:test';

import { handleAttempt } from './attempt';
import { createRunAttempt, getAgentBySlug } from '@senderos/senderos';
import { initHome } from '../../../senderos/src/test-support/runtime';

function createAttemptFixture() {
  const home = initHome();
  const agent = getAgentBySlug('spec-partner', home)!;
  const attempt = createRunAttempt({
    home,
    runId: 'run-1',
    attemptNumber: 1,
    agentId: agent.id,
    executionObjective: 'Execute work.',
    harness: 'codex',
    resumeCommand: 'codex resume abc',
  });
  return { home, attempt };
}

describe('attempt command', () => {
  test('list returns all attempts when no run filter is supplied', () => {
    const { home, attempt } = createAttemptFixture();

    expect((handleAttempt as any)('list', [], {}, home)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: attempt.id })]),
    );
  });

  test('list filters attempts by run id', () => {
    const { home, attempt } = createAttemptFixture();

    expect(
      (handleAttempt as any)('list', [], { 'run-id': attempt.runId }, home),
    ).toEqual([expect.objectContaining({ id: attempt.id })]);
  });

  test('show returns a concrete attempt', () => {
    const { home, attempt } = createAttemptFixture();

    expect(
      (handleAttempt as any)('show', ['attempt', 'show', attempt.id], {}, home)
        .id,
    ).toBe(attempt.id);
  });

  test('update records execution metadata and a non-terminal status', () => {
    const { home, attempt } = createAttemptFixture();

    const updated = (handleAttempt as any)(
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

  test('update finalizes a failed attempt and parses its result payload', () => {
    const { home, attempt } = createAttemptFixture();

    const updated = (handleAttempt as any)(
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

    expect(updated.status).toBe('failed');
    expect(updated.failureStep).toBe('verification');
    expect(updated.resultJson).toBe('{"validated":false}');
  });

  test('resume returns the persisted host resume instruction', () => {
    const { home, attempt } = createAttemptFixture();

    expect(
      (handleAttempt as any)(
        'resume',
        ['attempt', 'resume', attempt.id],
        {},
        home,
      ).resumeCommand,
    ).toBe('codex resume abc');
  });

  test('rejects unknown actions and missing attempt ids', () => {
    const { home } = createAttemptFixture();

    expect(() => (handleAttempt as any)('unknown', [], {}, home)).toThrow(
      'Unknown attempt action',
    );
    expect(() =>
      (handleAttempt as any)('show', ['attempt', 'show'], {}, home),
    ).toThrow('Missing required argument: attempt id');
  });
});
