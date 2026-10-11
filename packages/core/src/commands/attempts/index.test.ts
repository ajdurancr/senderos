import { startTestWorker } from '../../test-support/worker';
import { plan as nextPlan } from "../planning/plan";
import { expect, test } from "bun:test";
import { activateGoal, createGoal } from "../../index";
import { dispatchRun } from "../runs/dispatch";
import { listAgentTransitions } from "../transitions/list";
import { getRunAttempt } from "./get";
import { listRunAttempts } from "./list";
import { updateRunAttempt } from "./update";
import { recordAttemptEvidence } from "./evidence";
import { reviewRunAttempt } from "./review";
import { createProjectFixture, initHome } from "../../test-support/runtime";

test("attempt commands read and update a dispatched attempt", async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const goal = (await activateGoal(
    (
      await createGoal({
        home,
        projectId: project.id,
        title: "Attempt command",
      })
    ).id,
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

  const claim = await startTestWorker(home, project.id, dispatched.attemptId);
  expect(await listRunAttempts(dispatched.runId, home)).toHaveLength(1);
  expect((await getRunAttempt(dispatched.attemptId, home))?.id).toBe(
    dispatched.attemptId,
  );
  expect(
    (
      await updateRunAttempt(
        dispatched.attemptId,
        { checkpoint: "verified", token: claim.token },
        home,
      )
    )?.checkpoint,
  ).toBe("verified");
  const evidence = await recordAttemptEvidence({
    attemptId: dispatched.attemptId,
    kind: "test",
    label: "Unit suite passed",
    home,
  });
  expect(evidence.kind).toBe("test");
  expect(
    (
      await reviewRunAttempt({
        attemptId: dispatched.attemptId,
        status: "approved",
        reviewer: "Tony",
        home,
      })
    ).status,
  ).toBe("approved");
  const snapshot = JSON.parse(
    (await getRunAttempt(dispatched.attemptId, home))!.statusSnapshotJson,
  );
  expect(snapshot.evidence[0].id).toBe(evidence.id);
  expect(snapshot.review.status).toBe("approved");
  expect(snapshot.review.reviewer).toBe("Tony");
});
