import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { initHome, createProjectFixture } from '../test-support/runtime';
import { startTestWorker } from '../test-support/worker';
import { createGoal, activateGoal, dispatchRun, updateRunAttempt, reviewRunAttempt, recordAttemptEvidence, cancelGoal, draftSendero, publishSendero } from '../index';
import { explainGoal } from './state';
import { setCompletionPolicy } from './versions';
import { openRuntimeDb } from '../db/client';
import { activations, senderoNodes } from '../db/schema';

for (const legacy of [false, true]) test(`completion guidance preserves pinned ${legacy ? 'legacy edge' : 'node'} prerequisites and removes only satisfied facts`, async () => {
  const home = await initHome(), project = await createProjectFixture(home);
  await draftSendero('software-delivery', home);
  await setCompletionPolicy({ senderoId: 'software-delivery', agent: 'spec-partner', requireReview: true, evidenceKinds: ['test', 'artifact'] }, home);
  const graph = (await publishSendero('software-delivery', home))!;
  if (legacy) {
    // Isolated fixture representing an existing legacy publication. Its effective
    // policy lives on outgoing edges; the empty node policy must not override it.
    const node = graph.nodes.find(node => node.executionObjective !== null && JSON.parse(node.completionJson).requireReview)!;
    await openRuntimeDb(home).update(senderoNodes).set({ executionObjective: null, completionJson: '{}' }).where(eq(senderoNodes.id, node.id));
  }
  const goal = await createGoal({ home, projectId: project.id, title: 'Completion prerequisites' });
  await activateGoal(goal.id, home);
  const run = await dispatchRun({ goalId: goal.id }, home);
  const claim = await startTestWorker(home, project.id, run.attemptId);
  expect((await explainGoal(goal.id, home)).completion).toBeUndefined();
  await updateRunAttempt(run.attemptId, { status: 'paused', token: claim.token }, home);
  expect(await explainGoal(goal.id, home)).toMatchObject({ reason: 'waiting_for_review_or_resume' });
  expect((await explainGoal(goal.id, home)).completion).toBeUndefined();
  await updateRunAttempt(run.attemptId, { status: 'succeeded', token: claim.token }, home);
  const waiting = await explainGoal(goal.id, home);
  expect(waiting).toMatchObject({ state: 'blocked', reason: 'completion_prerequisites', nextAction: 'review_or_record_evidence', attemptId: run.attemptId,
    completion: { missingEvidenceKinds: ['test', 'artifact'], missingReview: true } });
  expect(waiting.activations.find(item => item.attemptId === run.attemptId)?.completion).toEqual(waiting.completion);
  const db = openRuntimeDb(home);
  await db.update(activations).set({ nodeId: 'missing-pinned-node' }).where(eq(activations.id, waiting.activationId!));
  const damaged = await explainGoal(goal.id, home);
  expect(damaged).toMatchObject({ state: 'blocked', reason: 'INCONSISTENT_HISTORY' });
  expect(damaged.completion).toBeUndefined();
  await db.update(activations).set({ nodeId: waiting.nodeId! }).where(eq(activations.id, waiting.activationId!));
  // A later publication must never replace the existing goal's completion rules.
  await draftSendero('software-delivery', home);
  await setCompletionPolicy({ senderoId: 'software-delivery', agent: 'spec-partner', requireReview: false, evidenceKinds: [] }, home);
  await publishSendero('software-delivery', home);
  expect((await explainGoal(goal.id, home)).completion).toEqual(waiting.completion);
  await recordAttemptEvidence({ home, attemptId: run.attemptId, kind: 'manual', label: 'Manual is not a test' });
  expect((await explainGoal(goal.id, home)).completion).toEqual(waiting.completion);
  await recordAttemptEvidence({ home, attemptId: run.attemptId, kind: 'test', label: 'Test result' });
  expect((await explainGoal(goal.id, home)).completion).toEqual({ missingEvidenceKinds: ['artifact'], missingReview: true });
  await reviewRunAttempt({ home, attemptId: run.attemptId, status: 'approved', reviewer: 'Fixture operator' });
  expect((await explainGoal(goal.id, home)).completion).toEqual({ missingEvidenceKinds: ['artifact'], missingReview: false });
  await recordAttemptEvidence({ home, attemptId: run.attemptId, kind: 'artifact', label: 'Artifact' });
  const settled = await explainGoal(goal.id, home);
  expect(settled.completion).toBeUndefined();
  expect(settled.activations.find(item => item.activationId === waiting.activationId)?.completion).toBeUndefined();
});

test('cancellation suppresses completion prerequisites while the host acknowledgement is pending', async () => {
  const home = await initHome(), project = await createProjectFixture(home);
  await draftSendero('software-delivery', home);
  await setCompletionPolicy({ senderoId: 'software-delivery', agent: 'spec-partner', requireReview: true, evidenceKinds: ['test'] }, home);
  await publishSendero('software-delivery', home);
  const goal = await createGoal({ home, projectId: project.id, title: 'Cancel pending completion' });
  await activateGoal(goal.id, home);
  const run = await dispatchRun({ goalId: goal.id }, home);
  const claim = await startTestWorker(home, project.id, run.attemptId);
  await updateRunAttempt(run.attemptId, { status: 'succeeded', token: claim.token }, home);
  expect((await explainGoal(goal.id, home)).completion).toEqual({ missingEvidenceKinds: ['test'], missingReview: true });
  await cancelGoal(goal.id, home);
  const decision = await explainGoal(goal.id, home);
  expect(decision).toMatchObject({ reason: 'cancellation_requested', nextAction: 'acknowledge_cancel' });
  expect(decision.completion).toBeUndefined();
});
