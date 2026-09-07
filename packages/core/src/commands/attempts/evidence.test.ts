import { expect, test } from 'bun:test';
import { activateGoal, createGoal } from '../../index';
import { createProjectFixture, initHome } from '../../test-support/runtime';
import { dispatchRun } from '../runs/dispatch';
import { listAgentTransitions } from '../transitions/list';
import { getRunAttempt } from './get';
import { recordAttemptEvidence } from './evidence';

test('recordAttemptEvidence persists evidence and opens a pending review', async () => {
  const home = await initHome(); const project = await createProjectFixture(home);
  const goal = (await activateGoal((await createGoal({ home, projectId: project.id, title: 'Evidence' })).id, home))!;
  const transition = (await listAgentTransitions(home))[0]!;
  const dispatched = await dispatchRun({ goalId: goal.id, transitionId: transition.id, agentId: transition.sourceAgentId }, home);
  const evidence = await recordAttemptEvidence({ attemptId: dispatched.attemptId, kind: 'ci', label: 'CI passed', home });
  const snapshot = JSON.parse((await getRunAttempt(dispatched.attemptId, home))!.statusSnapshotJson);
  expect(snapshot.evidence[0].id).toBe(evidence.id);
  expect(snapshot.review.status).toBe('pending');
});
