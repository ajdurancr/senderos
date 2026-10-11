import { eq } from "drizzle-orm";
import { atomic, openRuntimeDb } from "../../db/client";
import { agents, activations, attemptClaims, goalExecutions, goals, lifecycleRequests, projects, runAttempts, runs } from "../../db/schema";
import { cursor, explainGoal } from "../../lifecycle/state";
import { requireGoal } from "../../lifecycle/scope";
import { requireLifecycle } from "../../lifecycle/errors";
import { executableGraph } from "../../lifecycle/route";
import { createRunAttempt } from "../attempts/create";
import { createRunRecord } from "./create";
import { now } from "../../shared/ids";
import { emitEvent } from "../../shared/events";
import { loadConfig } from "../../shared/config";
import { plan } from "../planning/plan";

export type DispatchInput = { goalId: string; activationId?: string; transitionId?: string; agentId?: string; previousRunId?: string; workingPath?: string; requestId?: string; expectedRevision?: number };
export async function dispatchRun(input: DispatchInput, home?: string) {
  return atomic(home, async () => {
    const goal = await requireGoal(input.goalId, home), db = openRuntimeDb(home);
    const fingerprint = JSON.stringify([input.goalId, input.activationId ?? null, input.transitionId ?? null, input.agentId ?? null, input.previousRunId ?? null, input.workingPath ?? null, input.expectedRevision ?? null]);
    const requestKey = input.requestId ? JSON.stringify([goal.id, input.requestId]) : undefined;
    if (requestKey) {
      const existing = (await db.select().from(lifecycleRequests).where(eq(lifecycleRequests.id, requestKey)))[0];
      if (existing) { requireLifecycle(existing.fingerprint === fingerprint, "IDEMPOTENCY_CONFLICT", "Request ID was already used with different inputs"); return JSON.parse(existing.responseJson) as { goalId: string; activationId: string; previousRunId: string | null; runId: string; attemptId: string }; }
    }
    const explanation = await explainGoal(goal.id, home);
    const ready = explanation.activations.filter(d => d.state === "ready");
    requireLifecycle(input.activationId || ready.length <= 1, "ACTIVATION_REQUIRED", "Multiple activations are ready; select activationId from plan");
    const decision = ready.find(d => !input.activationId || d.activationId === input.activationId);
    requireLifecycle(decision, "NOT_READY", `Activation is not dispatchable: ${explanation.reason}. ${explanation.nextAction}`);
    requireLifecycle(input.expectedRevision === undefined || input.expectedRevision === decision.revision, "STALE_PLAN", "Execution changed; plan again");
    requireLifecycle(!input.transitionId || input.transitionId === decision.transitionId, "STALE_PLAN", "Transition is not the next eligible step for this activation");
    requireLifecycle(!input.agentId || input.agentId === decision.agentId, "INVALID_AGENT", "Agent must match the activation");
    requireLifecycle(!input.previousRunId || input.previousRunId === decision.previousRunId, "STALE_PLAN", "previous-run-id must reference this activation's predecessor or retry");
    const state = await cursor(goal.id, home), graph = await executableGraph(goal.senderoVersionId, home, false);
    const activation = (await db.select().from(activations).where(eq(activations.id, decision.activationId!)))[0]!;
    const step = graph.steps.find(s => s.nodeId === activation.nodeId)!;
    requireLifecycle((await db.select().from(agents).where(eq(agents.id, step.agentId)))[0]?.status === "active", "AGENT_UNAVAILABLE", "Activation agent is unavailable");
    const previous = decision.previousRunId ? (await db.select().from(runAttempts).where(eq(runAttempts.runId, decision.previousRunId)))[0] : undefined;
    const run = (await createRunRecord(goal as Parameters<typeof createRunRecord>[0], home))!;
    await db.update(runs).set({ activationId: activation.id, status: "queued", maxAttempts: activation.maxAttempts }).where(eq(runs.id, run.id));
    const configuredHarness = home ? loadConfig(home).defaultHarness : "unknown";
    const strict = graph.version.protocolVersion === 2;
    const attempt = await createRunAttempt({ home, runId: run.id, attemptNumber: activation.attemptsUsed + 1, agentId: step.agentId, transitionId: step.id, executionObjective: step.objective, harness: configuredHarness, status: "queued", checkpoint: "awaiting_host", workingPath: strict ? null : input.workingPath ?? previous?.workingPath ?? null, workingPathMode: strict ? null : input.workingPath ? "new" : previous?.workingPath ? "reused" : null, retryFromAttemptId: activation.latestRunId && previous ? previous.id : null, debugMeta: { activationId: activation.id, previousRunId: decision.previousRunId } });
    const history = await db.select({ attempt: runAttempts, run: runs }).from(runAttempts).innerJoin(runs, eq(runAttempts.runId, runs.id)).where(eq(runs.goalId, goal.id));
    const project = (await db.select().from(projects).where(eq(projects.id, goal.projectId)))[0]!;
    const packet = { schemaVersion: strict ? 2 : 1, goal: { id: goal.id, projectId: goal.projectId, title: goal.title, specText: goal.specText, intakeText: goal.intakeText }, project: { id: project.id, executionContextId: project.executionContextId, workspaceRef: project.id }, senderoVersionId: goal.senderoVersionId, activation: { id: activation.id, nodeId: activation.nodeId, parentActivationId: activation.parentActivationId, scopes: JSON.parse(activation.scopesJson), input: JSON.parse(activation.inputJson) }, agent: step.agent, objective: step.objective, completion: step.policy, requiredCapabilities: step.requirements, workingPath: attempt.workingPath, requestedWorkingPath: input.workingPath ?? null, previous: previous ? { attemptId: previous.id, result: JSON.parse(previous.resultJson), snapshot: JSON.parse(previous.statusSnapshotJson), workingPath: previous.workingPath } : null, history: history.filter(({ attempt: a }) => a.id !== attempt.id).map(({ attempt: a, run: r }) => ({ activationId: r.activationId, attemptId: a.id, transitionId: a.transitionId, status: a.status, result: JSON.parse(a.resultJson), snapshot: JSON.parse(a.statusSnapshotJson), workingPath: a.workingPath })) };
    await db.insert(attemptClaims).values({ attemptId: attempt.id, protocolVersion: graph.version.protocolVersion, packetJson: JSON.stringify(packet) });
    await db.update(activations).set({ latestRunId: run.id, status: "running", attemptsUsed: activation.attemptsUsed + 1, revision: activation.revision + 1, updatedAt: now() }).where(eq(activations.id, activation.id));
    await db.update(goalExecutions).set({ latestRunId: run.id, transitionId: step.id, attemptsUsed: activation.attemptsUsed + 1, revision: state.revision + 1 }).where(eq(goalExecutions.goalId, goal.id));
    await db.update(goals).set({ status: "active", updatedAt: now() }).where(eq(goals.id, goal.id));
    const response = { goalId: goal.id, activationId: activation.id, previousRunId: decision.previousRunId ?? null, runId: run.id, attemptId: attempt.id };
    if (requestKey) await db.insert(lifecycleRequests).values({ id: requestKey, goalId: goal.id, fingerprint, responseJson: JSON.stringify(response) });
    await emitEvent(db, "goal.step-dispatched", "goal", goal.id, response);
    return response;
  });
}
/** Reserve exactly the reviewed set atomically, never a newly recomputed global plan. */
export async function dispatchReviewed(input: { items: Array<{ goalId: string; activationId: string; revision: number; transitionId?: string; agentId?: string; previousRunId?: string | null }>; executionContextId?: string; projectId?: string }, home?: string) {
  return atomic(home, async () => {
    requireLifecycle(Array.isArray(input.items) && input.items.length > 0, "INVALID_INPUT", "Select at least one reviewed activation");
    requireLifecycle(new Set(input.items.map(i => i.activationId)).size === input.items.length, "INVALID_INPUT", "Reviewed activations must be unique");
    const planned = await plan({ home, executionContextId: input.executionContextId });
    for (const item of input.items) {
      const goal = await requireGoal(item.goalId, home), project = (await openRuntimeDb(home).select().from(projects).where(eq(projects.id, goal.projectId)))[0]!;
      requireLifecycle((!input.executionContextId || project.executionContextId === input.executionContextId) && (!input.projectId || project.id === input.projectId), "SCOPE_MISMATCH", "Reviewed item is outside the displayed scope");
      requireLifecycle(planned.some(p => p.goalId === item.goalId && p.activationId === item.activationId && p.revision === item.revision && (!item.transitionId || p.transitionId === item.transitionId) && (!item.agentId || p.agentId === item.agentId)), "STALE_PLAN", "A reviewed activation changed; review the refreshed plan");
    }
    const results = [];
    for (const item of input.items) results.push(await dispatchRun({ goalId: item.goalId, activationId: item.activationId, expectedRevision: item.revision, requestId: `reviewed:${item.activationId}:${item.revision}` }, home));
    return results;
  });
}
