import { openRuntimeDb } from "../../db/client";
import { goals, projects, senderos, senderoVersions } from "../../db/schema";
import { emitEvent } from "../../shared/events";
import { now, randomId } from "../../shared/ids";
import type { GoalKind } from "../../shared/types";
import { getGoal } from "./get";
import { eq } from "drizzle-orm";

async function requireProject(projectId: string, home?: string) {
  const db = openRuntimeDb(home);
  const project = (
    await db.select().from(projects).where(eq(projects.id, projectId))
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
}) {
  const project = await requireProject(input.projectId, input.home);
  const db = openRuntimeDb(input.home);
  const id = input.id ?? randomId("goal");
  const ts = now();
  const defaultSendero = (await db.select().from(senderos).where(eq(senderos.status, "active")))[0];
  const defaultVersion = defaultSendero
    ? (await db.select().from(senderoVersions).where(eq(senderoVersions.senderoId, defaultSendero.id))).find((item) => item.version === defaultSendero.currentVersion)
    : undefined;
  await db.insert(goals).values({
    id,
    projectId: input.projectId,
    title: input.title,
    kind: input.kind ?? "feature",
    intakeText: input.intakeText ?? "",
    specText: input.specText ?? "",
    status: "draft",
    senderoVersionId: input.senderoVersionId === undefined ? defaultVersion?.id ?? null : input.senderoVersionId,
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
}
