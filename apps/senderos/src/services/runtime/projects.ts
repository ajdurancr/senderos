import type { IntegrationMode, ProjectRecord, ProjectStatus } from '../../domain/types';
import { openConfiguredCommandDb } from '../../db/client';
import { mapProjectRow } from '../../db/mappers';
import { now, randomId } from '../../utils/common';
import { emitEvent } from '../events';

export function createProject(input: {
  home?: string;
  name: string;
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
  const db = openConfiguredCommandDb(input.home);
  const ts = now();
  const id = input.id ?? randomId('project');
  const githubRemote =
    input.githubRemote ?? `https://github.com/${input.githubOwner}/${input.githubRepo}.git`;

  db.prepare(
    'insert into projects (id,name,canonical_path,github_owner,github_repo,github_remote,target_branch,status,integration_mode,inferred_commands_json,health_details_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    id,
    input.name,
    input.canonicalPath,
    input.githubOwner,
    input.githubRepo,
    githubRemote,
    input.targetBranch ?? 'main',
    input.status ?? 'healthy',
    input.integrationMode ?? 'github_pr',
    JSON.stringify(input.inferredCommands ?? {}),
    JSON.stringify(input.healthDetails ?? {}),
    ts,
    ts
  );

  emitEvent(db, 'project.created', 'project', id, {
    name: input.name,
    targetBranch: input.targetBranch ?? 'main',
  });
  db.close();

  return getProject(id, input.home)!;
}

export function getProject(id: string, home?: string): ProjectRecord | null {
  const db = openConfiguredCommandDb(home);
  const row = mapProjectRow(db.query('select * from projects where id = ?').get(id));
  db.close();
  return row;
}

export function listProjects(home?: string): ProjectRecord[] {
  const db = openConfiguredCommandDb(home);
  const rows = db.query('select * from projects order by created_at asc').all().map(mapProjectRow) as ProjectRecord[];
  db.close();
  return rows;
}
