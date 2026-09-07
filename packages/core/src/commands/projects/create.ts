import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { IntegrationMode, ProjectStatus } from '../../shared/types';
import { defaultProjectIdForPath } from './default-id-for-path';
import { defaultProjectNameForPath } from './default-name-for-path';
import { getProject } from './get';
import { projects } from '../../db/schema';
export async function createProject(input: {
  home?: string;
  name?: string;
  canonicalPath: string;
  githubOwner: string;
  githubRepo: string;
  githubRemote?: string;
  targetBranch?: string;
  integrationMode?: IntegrationMode;
  inferredCommands?: Record<string, unknown>;
  healthDetails?: Record<string, unknown>;
  status?: ProjectStatus;
  id?: string;
}) {
  const db = openRuntimeDb(input.home);
  const ts = now();
  const id = input.id ?? defaultProjectIdForPath(input.canonicalPath);
  const name = input.name ?? defaultProjectNameForPath(input.canonicalPath);
  const remote =
    input.githubRemote ??
    `https://github.com/${input.githubOwner}/${input.githubRepo}.git`;
  await db.insert(projects).values({ id, name, canonicalPath: input.canonicalPath, githubOwner: input.githubOwner, githubRepo: input.githubRepo, githubRemote: remote, targetBranch: input.targetBranch ?? 'main', status: input.status ?? 'healthy', integrationMode: input.integrationMode ?? 'github_pr', inferredCommandsJson: JSON.stringify(input.inferredCommands ?? {}), healthDetailsJson: JSON.stringify(input.healthDetails ?? {}), createdAt: ts, updatedAt: ts });
  await emitEvent(db, 'project.created', 'project', id, {
    name,
    targetBranch: input.targetBranch ?? 'main',
  });
  return (await getProject(id, input.home))!;
}
