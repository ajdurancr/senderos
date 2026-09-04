import { expect, test } from 'bun:test';
import { activateGoal, createGoal } from '../../index';
import { dispatchRun } from '../runs/dispatch';
import { listAgentTransitions } from '../transitions/list';
import { getRunAttempt } from './get';
import { listRunAttempts } from './list';
import { updateRunAttempt } from './update';
import { recordAttemptEvidence } from './evidence';
import { reviewRunAttempt } from './review';
import { createProjectFixture, initHome } from '../../test-support/runtime';

test('attempt commands read and update a dispatched attempt', () => {
  const home = initHome();
  const project = createProjectFixture(home);
  const goal = activateGoal(
    createGoal({ home, projectId: project.id, title: 'Attempt command' }).id,
    home,
  )!;
  const transition = listAgentTransitions(home)[0]!;
  const dispatched = dispatchRun(
    {
      goalId: goal.id,
      transitionId: transition.id,
      agentId: transition.sourceAgentId,
    },
    home,
  );

  expect(listRunAttempts(dispatched.runId, home)).toHaveLength(1);
  expect(getRunAttempt(dispatched.attemptId, home)?.id).toBe(
    dispatched.attemptId,
  );
  expect(
    updateRunAttempt(dispatched.attemptId, { checkpoint: 'verified' }, home)
      ?.checkpoint,
  ).toBe('verified');
  const evidence = recordAttemptEvidence({
    attemptId: dispatched.attemptId,
    kind: 'test',
    label: 'Unit suite passed',
    home,
  });
  expect(evidence.kind).toBe('test');
  expect(
    reviewRunAttempt({
      attemptId: dispatched.attemptId,
      status: 'approved',
      reviewer: 'Tony',
      home,
    }).status,
  ).toBe('approved');
  const snapshot = JSON.parse(
    getRunAttempt(dispatched.attemptId, home)!.statusSnapshotJson,
  );
  expect(snapshot.evidence[0].id).toBe(evidence.id);
  expect(snapshot.review.status).toBe('approved');
  expect(snapshot.review.reviewer).toBe('Tony');
});
