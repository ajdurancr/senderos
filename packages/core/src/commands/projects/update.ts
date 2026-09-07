import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { IntegrationMode, ProjectStatus } from '../../shared/types';
import { getProject } from './get';
import { sql } from 'drizzle-orm';
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
  await db.run(sql`update projects set name=${input.name ?? current.name},canonical_path=${input.canonicalPath ?? current.canonicalPath},github_owner=${input.githubOwner ?? current.githubOwner},github_repo=${input.githubRepo ?? current.githubRepo},github_remote=${input.githubRemote ?? current.githubRemote},target_branch=${input.targetBranch ?? current.targetBranch},status=${input.status ?? current.status},integration_mode=${input.integrationMode ?? current.integrationMode},inferred_commands_json=${JSON.stringify(input.inferredCommands ?? JSON.parse(current.inferredCommandsJson || '{}'))},health_details_json=${JSON.stringify(input.healthDetails ?? JSON.parse(current.healthDetailsJson || '{}'))},updated_at=${now()} where id=${input.id}`);
  await emitEvent(db, 'project.updated', 'project', input.id, input);
  return getProject(input.id, input.home);
}
