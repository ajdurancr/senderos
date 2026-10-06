import { atomic, openRuntimeDb } from "../../db/client";
import { requireLifecycle } from "../../lifecycle/errors";
import { requireGoal } from '../../lifecycle/scope';
import { goals, projects, senderos, senderoVersions } from "../../db/schema";
import { emitEvent } from "../../shared/events";
import { now, randomId } from "../../shared/ids";
import type { GoalKind } from "../../shared/types";
import { getGoal } from "./get";
import { and, eq } from "drizzle-orm";

async function requireProject(projectId: string, home?: string, executionContextId?: string) {
  const db = openRuntimeDb(home);
  const project = (
    await db.select().from(projects).where(executionContextId
      ? and(eq(projects.id, projectId), eq(projects.executionContextId, executionContextId))
      : eq(projects.id, projectId))
  )[0];
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
}
export async function createGoal(input: {
  home?: string;
  projectId: string;
  title: string;
  kind?: GoalKind;
  specText?: string;
  intakeText?: string;
  id?: string;
  senderoVersionId?: string | null;
  executionContextId?: string;
}) {
  return atomic(input.home, async () => {
  requireLifecycle(typeof input.title === 'string' && input.title.trim().length > 0, 'INVALID_INPUT', 'Goal title is required');
  requireLifecycle(input.kind === undefined || ['feature', 'bugfix', 'refactor', 'maintenance', 'security', 'migration'].includes(input.kind), 'INVALID_INPUT', 'Invalid goal kind');
  const project = await requireProject(input.projectId, input.home, input.executionContextId);
  const db = openRuntimeDb(input.home);
  const id = input.id ?? randomId("goal");
  if (input.id && (await getGoal(input.id, input.home))) {
    const existing = await requireGoal(input.id, input.home);
    requireLifecycle(existing.projectId === input.projectId && existing.title === input.title && existing.specText === (input.specText ?? '') && existing.intakeText === (input.intakeText ?? '') && existing.kind === (input.kind ?? 'feature') && (input.senderoVersionId === undefined || existing.senderoVersionId === input.senderoVersionId), 'IDEMPOTENCY_CONFLICT', 'Goal ID already exists with different inputs');
    return (await getGoal(input.id, input.home))!;
  }
  const ts = now();
  const activeSenderos = await db
    .select()
    .from(senderos)
    .where(eq(senderos.status, "active"));
  const defaultSendero =
    activeSenderos.find((sendero) => sendero.isDefault) ?? activeSenderos[0];
  const defaultVersion = defaultSendero
    ? (
        await db
          .select()
          .from(senderoVersions)
          .where(eq(senderoVersions.senderoId, defaultSendero.id))
      ).find((item) => item.version === defaultSendero.currentVersion)
    : undefined;
  if (input.senderoVersionId) {
    const selected = (await db.select().from(senderoVersions).where(eq(senderoVersions.id, input.senderoVersionId)))[0];
    requireLifecycle(selected?.status === 'published', 'INVALID_WORKFLOW', 'Select a published Sendero version');
  }
  await db.insert(goals).values({
    id,
    projectId: input.projectId,
    title: input.title,
    kind: input.kind ?? "feature",
    intakeText: input.intakeText ?? "",
    specText: input.specText ?? "",
    status: "draft",
    senderoVersionId:
      input.senderoVersionId === undefined
        ? (defaultVersion?.id ?? null)
        : input.senderoVersionId,
    baseTargetBranch: project.targetBranch,
    branchName: null,
    prUrl: null,
    prNumber: null,
    createdAt: ts,
    updatedAt: ts,
  });
  await emitEvent(db, "goal.created", "goal", id, {
    projectId: input.projectId,
  });
  return (await getGoal(id, input.home))!;
  });
}
