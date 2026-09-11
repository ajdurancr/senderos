import { createRunAttempt } from "../attempts/create";
import { listRunAttempts } from "../attempts/list";
import { getGoal } from "../goals/get";
import { getAgentTransition } from "../transitions/get";
import { eq } from "drizzle-orm";
import { openRuntimeDb } from "../../db/client";
import { senderoEdges, senderoNodes } from "../../db/schema";
import { now } from "../../shared/ids";
import { createRunRecord } from "./create";
import { getRun } from "./get";
export async function dispatchRun(
  input: {
    goalId: string;
    transitionId: string;
    agentId: string;
    previousRunId?: string;
    workingPath?: string;
  },
  home?: string,
) {
  const goal = await getGoal(input.goalId, home);
  if (!goal) throw new Error(`Goal not found: ${input.goalId}`);
  if (!["active", "failed"].includes(goal.status))
    throw new Error(`Goal is not dispatchable from status ${goal.status}`);
  const legacyTransition = await getAgentTransition(input.transitionId, home);
  const db = openRuntimeDb(home);
  const senderoEdge = (
    await db
      .select()
      .from(senderoEdges)
      .where(eq(senderoEdges.id, input.transitionId))
  )[0];
  const sourceNode = senderoEdge
    ? (
        await db
          .select()
          .from(senderoNodes)
          .where(eq(senderoNodes.id, senderoEdge.sourceNodeId))
      )[0]
    : null;
  const transition =
    legacyTransition ??
    (senderoEdge && sourceNode?.agentId
      ? {
          id: senderoEdge.id,
          sourceAgentId: sourceNode.agentId,
          status: senderoEdge.status,
          transitionObjective: senderoEdge.transitionObjective,
        }
      : null);
  if (!transition || transition.status !== "active")
    throw new Error(`Active agent transition not found: ${input.transitionId}`);
  if (transition.sourceAgentId !== input.agentId)
    throw new Error("Agent must match the transition source agent");
  const previous = input.previousRunId
    ? await getRun(input.previousRunId, home)
    : null;
  if (
    input.previousRunId &&
    (!previous ||
      previous.goalId !== goal.id ||
      !["failed", "succeeded"].includes(previous.status))
  )
    throw new Error(
      "previous-run-id must reference a completed run for this goal",
    );
  const run = (await createRunRecord(goal, home))!;
  const priorAttempt = previous
    ? (await listRunAttempts(previous.id, home)).at(-1)
    : null;
  const attempt = await createRunAttempt({
    home,
    runId: run.id,
    attemptNumber: 1,
    agentId: input.agentId,
    transitionId: transition.id,
    executionObjective: transition.transitionObjective,
    harness: "unknown",
    externalSessionId: null,
    resumeCommand: null,
    heartbeatAt: now(),
    hostEnvironmentName: "external-host-agent",
    workingPath: input.workingPath ?? priorAttempt?.workingPath ?? null,
    workingPathMode: input.workingPath
      ? "new"
      : priorAttempt?.workingPath
        ? "reused"
        : null,
    retryFromAttemptId: priorAttempt?.id ?? null,
    checkpoint: "dispatched",
    status: "running",
    startedAt: now(),
    debugMeta: { previousRunId: input.previousRunId ?? null },
  });
  return {
    goalId: goal.id,
    previousRunId: input.previousRunId ?? null,
    runId: run.id,
    attemptId: attempt.id,
  };
}
