import { atomic, openRuntimeDb } from "../../db/client";
import { emitEvent } from "../../shared/events";
import { now, randomId } from "../../shared/ids";
import type { IntegrationMode, ProjectStatus } from "../../shared/types";
import { defaultProjectIdForPath } from "./default-id-for-path";
import { defaultProjectNameForPath } from "./default-name-for-path";
import { getProject } from "./get";
import { projects } from "../../db/schema";
import { requireLifecycle } from "../../lifecycle/errors";
import { resolveExecutionContextId } from '../../shared/config';
export async function createProject(input: {
  home?: string;
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
  id?: string;
  executionContextId?: string;
}) {
  return atomic(input.home, async () => {
  const canonicalPath = input.canonicalPath?.trim() ?? '';
  const githubOwner = input.githubOwner?.trim() ?? '';
  const githubRepo = input.githubRepo?.trim() ?? '';
  requireLifecycle(Boolean(githubOwner) === Boolean(githubRepo), 'INVALID_INPUT', 'Supply both GitHub owner and repository, or neither');
  requireLifecycle(Boolean(canonicalPath) || Boolean(input.name?.trim()), 'INVALID_INPUT', 'A project name or workspace path is required');
  requireLifecycle(input.integrationMode === undefined || ['github_pr', 'local_merge', 'none'].includes(input.integrationMode), 'INVALID_INPUT', 'Invalid integration mode');
  const db = openRuntimeDb(input.home);
  const ts = now();
  const id = input.id ?? (canonicalPath ? defaultProjectIdForPath(canonicalPath) : randomId('project'));
  const name = input.name?.trim() || defaultProjectNameForPath(canonicalPath);
  const executionContextId = input.executionContextId ?? resolveExecutionContextId(input.home);
  const remote =
    input.githubRemote ??
    (githubOwner && githubRepo ? `https://github.com/${githubOwner}/${githubRepo}.git` : '');
  await db
    .insert(projects)
    .values({
      id,
      executionContextId,
      name,
      canonicalPath,
      githubOwner,
      githubRepo,
      githubRemote: remote,
      targetBranch: input.targetBranch ?? (githubRepo || input.integrationMode === 'local_merge' ? 'main' : ''),
      status: input.status ?? "healthy",
      integrationMode: input.integrationMode ?? (githubRepo ? 'github_pr' : 'none'),
      inferredCommandsJson: JSON.stringify(input.inferredCommands ?? {}),
      healthDetailsJson: JSON.stringify(input.healthDetails ?? {}),
      createdAt: ts,
      updatedAt: ts,
    });
  await emitEvent(db, "project.created", "project", id, {
    name,
    targetBranch: input.targetBranch ?? (githubRepo || input.integrationMode === 'local_merge' ? 'main' : ''),
  });
  return (await getProject(id, input.home))!;
  });
}
