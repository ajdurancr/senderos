import { atomic, openRuntimeDb } from "../../db/client";
import { emitEvent } from "../../shared/events";
import { requireLifecycle } from "../../lifecycle/errors";
import { now } from "../../shared/ids";
import type { IntegrationMode, ProjectStatus } from "../../shared/types";
import { getProject } from "./get";
import { projects } from "../../db/schema";
import { eq } from "drizzle-orm";
export async function updateProject(input: {
  home?: string;
  id: string;
  name?: string;
  canonicalPath?: string;
  githubOwner?: string;
  githubRepo?: string;
  githubRemote?: string;
  targetBranch?: string;
  integrationMode?: IntegrationMode;
  inferredCommands?: Record<string, string>;
  healthDetails?: Record<string, string | number | boolean | null>;
  status?: ProjectStatus;
  executionContextId?: string;
}) {
  return atomic(input.home, async () => {
    const current = await getProject(input.id, input.home, input.executionContextId);
    if (!current) throw new Error(`Project not found: ${input.id}`);
    const name = input.name?.trim() ?? current.name;
    const githubOwner = input.githubOwner?.trim() ?? current.githubOwner;
    const githubRepo = input.githubRepo?.trim() ?? current.githubRepo;
    requireLifecycle(Boolean(name), 'INVALID_INPUT', 'Project name is required');
    requireLifecycle(Boolean(githubOwner) === Boolean(githubRepo), 'INVALID_INPUT', 'Supply both GitHub owner and repository, or neither');
    const db = openRuntimeDb(input.home);
    await db
      .update(projects)
      .set({
        name,
        canonicalPath: input.canonicalPath ?? current.canonicalPath,
        githubOwner,
        githubRepo,
        githubRemote: input.githubRemote ?? current.githubRemote,
        targetBranch: input.targetBranch ?? current.targetBranch,
        status: input.status ?? current.status,
        integrationMode: input.integrationMode ?? current.integrationMode,
        inferredCommandsJson: JSON.stringify(
          input.inferredCommands ??
            JSON.parse(current.inferredCommandsJson || "{}"),
        ),
        healthDetailsJson: JSON.stringify(
          input.healthDetails ?? JSON.parse(current.healthDetailsJson || "{}"),
        ),
        updatedAt: now(),
      })
      .where(eq(projects.id, input.id));
    await emitEvent(db, "project.updated", "project", input.id, input);
    return getProject(input.id, input.home, input.executionContextId);
  });
}
