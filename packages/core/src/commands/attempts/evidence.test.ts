import { expect, test } from 'bun:test';
import { activateGoal, createGoal } from '../../index';
import { createProjectFixture, initHome } from '../../test-support/runtime';
import { dispatchRun } from '../runs/dispatch';
import { listAgentTransitions } from '../transitions/list';
import { getRunAttempt } from './get';
import { recordAttemptEvidence } from './evidence';

test('recordAttemptEvidence persists evidence and opens a pending review', () => {
  const home = initHome(); const project = createProjectFixture(home);
  const goal = activateGoal(createGoal({ home, projectId: project.id, title: 'Evidence' }).id, home)!;
  const transition = listAgentTransitions(home)[0]!;
  const dispatched = dispatchRun({ goalId: goal.id, transitionId: transition.id, agentId: transition.sourceAgentId }, home);
  const evidence = recordAttemptEvidence({ attemptId: dispatched.attemptId, kind: 'ci', label: 'CI passed', home });
  const snapshot = JSON.parse(getRunAttempt(dispatched.attemptId, home)!.statusSnapshotJson);
  expect(snapshot.evidence[0].id).toBe(evidence.id);
  expect(snapshot.review.status).toBe('pending');
});
