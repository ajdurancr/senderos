import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import type { IntegrationMode, ProjectRecord, ProjectStatus } from '../../shared/types';
import { openRuntimeDb } from '../../db/client';
import { mapProjectRow } from '../../db/mappers';
import { now, randomId } from '../../shared/ids';
import { emitEvent } from '../../shared/events';

function safeProjectPrefix(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[\\/]/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}

function packageMetadataForPath(canonicalPath: string) {
  const packageJsonPath = join(resolve(canonicalPath), 'package.json');

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { name?: string };
  } catch {
    return null;
  }
}

export function defaultProjectIdForPath(canonicalPath: string) {
  const pkg = packageMetadataForPath(canonicalPath);
  const prefix = safeProjectPrefix(pkg?.name ?? basename(resolve(canonicalPath)));
  return `${prefix}-${randomId('tmp').slice(4)}`;
}

export function defaultProjectNameForPath(canonicalPath: string) {
  const pkg = packageMetadataForPath(canonicalPath);
  return pkg?.name ?? basename(resolve(canonicalPath));
}

export function createProject(input: {
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
  const githubRemote =
    input.githubRemote ?? `https://github.com/${input.githubOwner}/${input.githubRepo}.git`;
  const name = input.name ?? defaultProjectNameForPath(input.canonicalPath);

  db.prepare(
    'insert into projects (id,name,canonical_path,github_owner,github_repo,github_remote,target_branch,status,integration_mode,inferred_commands_json,health_details_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    id,
    name,
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
    name,
    targetBranch: input.targetBranch ?? 'main',
  });
  db.close();

  return getProject(id, input.home)!;
}

export function getProject(id: string, home?: string): ProjectRecord | null {
  const db = openRuntimeDb(home);
  const row = mapProjectRow(db.query('select * from projects where id = ?').get(id));
  db.close();
  return row;
}

export function listProjects(home?: string): ProjectRecord[] {
  const db = openRuntimeDb(home);
  const rows = db
    .query('select * from projects order by created_at asc')
    .all()
    .map(mapProjectRow) as ProjectRecord[];
  db.close();
  return rows;
}

export function updateProject(input: {
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
  const current = getProject(input.id, input.home);

  if (!current) {
    throw new Error(`Project not found: ${input.id}`);
  }

  const db = openRuntimeDb(input.home);
  db.prepare(
    'update projects set name=?, canonical_path=?, github_owner=?, github_repo=?, github_remote=?, target_branch=?, status=?, integration_mode=?, inferred_commands_json=?, health_details_json=?, updated_at=? where id=?'
  ).run(
    input.name ?? current.name,
    input.canonicalPath ?? current.canonicalPath,
    input.githubOwner ?? current.githubOwner,
    input.githubRepo ?? current.githubRepo,
    input.githubRemote ?? current.githubRemote,
    input.targetBranch ?? current.targetBranch,
    input.status ?? current.status,
    input.integrationMode ?? current.integrationMode,
    JSON.stringify(input.inferredCommands ?? JSON.parse(current.inferredCommandsJson || '{}')),
    JSON.stringify(input.healthDetails ?? JSON.parse(current.healthDetailsJson || '{}')),
    now(),
    input.id
  );

  emitEvent(db, 'project.updated', 'project', input.id, input);
  db.close();

  return getProject(input.id, input.home);
}
