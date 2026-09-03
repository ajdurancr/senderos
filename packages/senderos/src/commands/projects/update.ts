import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { IntegrationMode, ProjectStatus } from '../../shared/types';
import { getProject } from './get';
export function updateProject(input: { home?: string; id: string; name?: string; canonicalPath?: string; githubOwner?: string; githubRepo?: string; githubRemote?: string; targetBranch?: string; integrationMode?: IntegrationMode; inferredCommands?: Record<string, unknown>; healthDetails?: Record<string, unknown>; status?: ProjectStatus }) {
  const current = getProject(input.id, input.home); if (!current) throw new Error(`Project not found: ${input.id}`); const db = openRuntimeDb(input.home);
  db.prepare('update projects set name=?, canonical_path=?, github_owner=?, github_repo=?, github_remote=?, target_branch=?, status=?, integration_mode=?, inferred_commands_json=?, health_details_json=?, updated_at=? where id=?').run(input.name ?? current.name, input.canonicalPath ?? current.canonicalPath, input.githubOwner ?? current.githubOwner, input.githubRepo ?? current.githubRepo, input.githubRemote ?? current.githubRemote, input.targetBranch ?? current.targetBranch, input.status ?? current.status, input.integrationMode ?? current.integrationMode, JSON.stringify(input.inferredCommands ?? JSON.parse(current.inferredCommandsJson || '{}')), JSON.stringify(input.healthDetails ?? JSON.parse(current.healthDetailsJson || '{}')), now(), input.id);
  emitEvent(db, 'project.updated', 'project', input.id, input); db.close(); return getProject(input.id, input.home);
}
