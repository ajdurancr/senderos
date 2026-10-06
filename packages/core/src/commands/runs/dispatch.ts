import { eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../../db/client";
import { agents, attemptClaims, goalExecutions, goals, lifecycleRequests, runAttempts, runs } from "../../db/schema";
import { cursor, explainGoal } from "../../lifecycle/state";
import { requireGoal } from "../../lifecycle/scope";
import { requireLifecycle } from "../../lifecycle/errors";
import { route } from "../../lifecycle/route";
import { createRunAttempt } from "../attempts/create";
import { createRunRecord } from "./create";
import { now } from "../../shared/ids";
import { emitEvent } from "../../shared/events";

export async function dispatchRun(input: {
  goalId: string; transitionId?: string; agentId?: string; previousRunId?: string;
  workingPath?: string; requestId?: string; expectedRevision?: number;
}, home?: string) {
  return atomic(home, async () => {
    const goal = await requireGoal(input.goalId, home);
    const db = openRuntimeDb(home);
    const fingerprint = JSON.stringify([input.goalId, input.transitionId ?? null, input.agentId ?? null, input.previousRunId ?? null, input.workingPath ?? null, input.expectedRevision ?? null]);
    const requestKey = input.requestId ? JSON.stringify([goal.id, input.requestId]) : undefined;
    if (requestKey) {
      const existing = (await db.select().from(lifecycleRequests).where(eq(lifecycleRequests.id, requestKey)))[0];
      if (existing) {
        requireLifecycle(existing.fingerprint === fingerprint, "IDEMPOTENCY_CONFLICT", "Request ID was already used with different inputs");
        return JSON.parse(existing.responseJson) as { goalId: string; previousRunId: string | null; runId: string; attemptId: string };
      }
    }
    const decision = await explainGoal(goal.id, home);
    requireLifecycle(decision.state === "ready", "NOT_READY", `Goal is not dispatchable: ${decision.reason}. ${decision.nextAction}`);
    requireLifecycle(input.expectedRevision === undefined || input.expectedRevision === decision.revision, "STALE_PLAN", "Execution changed; plan again");
    requireLifecycle(!input.transitionId || input.transitionId === decision.transitionId, "STALE_PLAN", "Transition is not the next eligible step for this goal");
    requireLifecycle(!input.agentId || input.agentId === decision.agentId, "INVALID_AGENT", "Agent must match the transition source agent");
    requireLifecycle(!input.previousRunId || input.previousRunId === decision.previousRunId, "STALE_PLAN", "previous-run-id must reference the latest completed run for this goal");
    const state = await cursor(goal.id, home);
    const step = (await route(goal.senderoVersionId, home)).find(s => s.id === decision.transitionId)!;
    const agent = (await db.select().from(agents).where(eq(agents.id, step.agentId)))[0]!;
    const previous = state.latestRunId ? (await db.select().from(runAttempts).where(eq(runAttempts.runId, state.latestRunId)))[0] : undefined;
    const run = (await createRunRecord(goal as Parameters<typeof createRunRecord>[0], home))!;
    const attempt = await createRunAttempt({ home, runId: run.id, attemptNumber: state.attemptsUsed + 1,
      agentId: step.agentId, transitionId: step.id, executionObjective: step.objective,
      harness: "unknown", status: "queued", checkpoint: "awaiting_host",
      workingPath: input.workingPath ?? previous?.workingPath ?? null,
      workingPathMode: input.workingPath ? "new" : previous?.workingPath ? "reused" : null,
      retryFromAttemptId: previous?.transitionId === step.id ? previous.id : null,
      debugMeta: { previousRunId: state.latestRunId },
    });
    const history = await db.select({ attempt: runAttempts }).from(runAttempts).innerJoin(runs, eq(runAttempts.runId, runs.id)).where(eq(runs.goalId, goal.id));
    const packet = { schemaVersion: 1, goal: { id: goal.id, title: goal.title, specText: goal.specText, intakeText: goal.intakeText },
      senderoVersionId: goal.senderoVersionId, agent: { id: agent.id, name: agent.name, instructions: agent.definitionBody },
      objective: step.objective, completion: step.policy, workingPath: attempt.workingPath,
      previous: previous ? { attemptId: previous.id, result: JSON.parse(previous.resultJson), snapshot: JSON.parse(previous.statusSnapshotJson), workingPath: previous.workingPath } : null,
      history: history.filter(({ attempt: a }) => a.id !== attempt.id).map(({ attempt: a }) => ({ attemptId: a.id, transitionId: a.transitionId, status: a.status, result: JSON.parse(a.resultJson), snapshot: JSON.parse(a.statusSnapshotJson), workingPath: a.workingPath })),
    };
    await db.insert(attemptClaims).values({ attemptId: attempt.id, packetJson: JSON.stringify(packet) });
    await db.update(goalExecutions).set({ latestRunId: run.id, attemptsUsed: state.attemptsUsed + 1, revision: state.revision + 1 }).where(eq(goalExecutions.goalId, goal.id));
    await db.update(goals).set({ status: "active", updatedAt: now() }).where(eq(goals.id, goal.id));
    const response = { goalId: goal.id, previousRunId: state.latestRunId, runId: run.id, attemptId: attempt.id };
    if (requestKey) await db.insert(lifecycleRequests).values({ id: requestKey, goalId: goal.id, fingerprint, responseJson: JSON.stringify(response) });
    await emitEvent(db, "goal.step-dispatched", "goal", goal.id, response);
    return response;
  });
}
