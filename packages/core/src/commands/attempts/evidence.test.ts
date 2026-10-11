import { plan as nextPlan } from "../planning/plan";
import { expect, test } from "bun:test";
import { activateGoal, createGoal } from "../../index";
import { createProjectFixture, initHome } from "../../test-support/runtime";
import { dispatchRun } from "../runs/dispatch";
import { listAgentTransitions } from "../transitions/list";
import { getRunAttempt } from "./get";
import { recordAttemptEvidence } from "./evidence";

test("recordAttemptEvidence persists evidence and opens a pending review", async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (await createGoal({ home, projectId: project.id, title: "Evidence" })).id,
    home,
  ))!;
  const planned = (await nextPlan({ home }))[0]!;
  const transition = { id: planned.transitionId, sourceAgentId: planned.agentId };
  const dispatched = await dispatchRun(
    {
      goalId: goal.id,
      transitionId: transition.id,
      agentId: transition.sourceAgentId,
    },
    home,
  );
  const evidence = await recordAttemptEvidence({
    attemptId: dispatched.attemptId,
    kind: "ci",
    label: "CI passed",
    home,
  });
  const snapshot = JSON.parse(
    (await getRunAttempt(dispatched.attemptId, home))!.statusSnapshotJson,
  );
  expect(snapshot.evidence[0].id).toBe(evidence.id);
  expect(snapshot.review.status).toBe("pending");
});

import { strictHostFixture } from '../../test-support/host-runtime';
import { scopedApi } from '../../lifecycle/scope';
import { reviewRunAttempt } from './review';
import { updateRunAttempt } from './update';
import { attemptClaims } from '../../db/schema';
import { eq } from 'drizzle-orm';
test('assigned remote workers can provide evidence with a fenced token, but cannot impersonate the project reviewer', async () => {
  const { home, attemptId, hostApi, db } = await strictHostFixture(true);
  const claim = await hostApi.claim(); await hostApi.start(claim.token);
  const remote = scopedApi({ evidence: (token?: string) => recordAttemptEvidence({ home, attemptId, token, kind: 'test', label: 'External worker tests passed' }), review: () => reviewRunAttempt({ home, attemptId, status: 'approved', reviewer: 'self' }), forge: () => updateRunAttempt(attemptId, { token: claim.token, statusSnapshot: { hostPreflight: { eligible: true } } }, home) }, 'remote');
  await expect(remote.evidence()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(remote.evidence('stale')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect((await remote.evidence(claim.token)).kind).toBe('test');
  await expect(remote.review()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(remote.forge()).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await db.update(attemptClaims).set({ leaseExpiresAt: '2000-01-01' }).where(eq(attemptClaims.attemptId, attemptId));
  await expect(remote.evidence(claim.token)).rejects.toMatchObject({ code: 'LEASE_EXPIRED' });
  expect((await recordAttemptEvidence({ home, attemptId, kind: 'manual', label: 'Project operator confirmation' })).kind).toBe('manual');
});
