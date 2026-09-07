import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { IntegrationMode, ProjectStatus } from '../../shared/types';
import { getProject } from './get';
import { projects } from '../../db/schema';
import { eq } from 'drizzle-orm';
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
  inferredCommands?: Record<string, unknown>;
  healthDetails?: Record<string, unknown>;
  status?: ProjectStatus;
}) {
  const current = await getProject(input.id, input.home);
  if (!current) throw new Error(`Project not found: ${input.id}`);
  const db = openRuntimeDb(input.home);
  await db.update(projects).set({ name: input.name ?? current.name, canonicalPath: input.canonicalPath ?? current.canonicalPath, githubOwner: input.githubOwner ?? current.githubOwner, githubRepo: input.githubRepo ?? current.githubRepo, githubRemote: input.githubRemote ?? current.githubRemote, targetBranch: input.targetBranch ?? current.targetBranch, status: input.status ?? current.status, integrationMode: input.integrationMode ?? current.integrationMode, inferredCommandsJson: JSON.stringify(input.inferredCommands ?? JSON.parse(current.inferredCommandsJson || '{}')), healthDetailsJson: JSON.stringify(input.healthDetails ?? JSON.parse(current.healthDetailsJson || '{}')), updatedAt: now() }).where(eq(projects.id, input.id));
  await emitEvent(db, 'project.updated', 'project', input.id, input);
  return getProject(input.id, input.home);
}
