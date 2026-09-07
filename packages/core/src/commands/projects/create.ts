import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { IntegrationMode, ProjectStatus } from '../../shared/types';
import { defaultProjectIdForPath } from './default-id-for-path';
import { defaultProjectNameForPath } from './default-name-for-path';
import { getProject } from './get';
import { sql } from 'drizzle-orm';
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
  await db.run(sql`insert into projects (id,name,canonical_path,github_owner,github_repo,github_remote,target_branch,status,integration_mode,inferred_commands_json,health_details_json,created_at,updated_at) values (${id},${name},${input.canonicalPath},${input.githubOwner},${input.githubRepo},${remote},${input.targetBranch ?? 'main'},${input.status ?? 'healthy'},${input.integrationMode ?? 'github_pr'},${JSON.stringify(input.inferredCommands ?? {})},${JSON.stringify(input.healthDetails ?? {})},${ts},${ts})`);
  await emitEvent(db, 'project.created', 'project', id, {
    name,
    targetBranch: input.targetBranch ?? 'main',
  });
  return (await getProject(id, input.home))!;
}
