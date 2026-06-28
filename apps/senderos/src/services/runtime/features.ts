import type { FeatureRecord } from '../../domain/types';
import { openConfiguredCommandDb } from '../../db/client';
import { mapFeatureRow, mapProjectRow } from '../../db/mappers';
import { now, randomId } from '../../utils/common';
import { emitEvent } from '../events';
import { cleanupWorkspace, ensurePhaseTask } from '../loop';

function requireProject(projectId: string, home?: string) {
  const db = openConfiguredCommandDb(home);
  const project = mapProjectRow(db.query('select * from projects where id = ?').get(projectId));
  db.close();

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return project;
}

function completeActiveSessionsForFeature(featureId: string, home?: string, reason = 'feature_canceled') {
  const db = openConfiguredCommandDb(home);
  const sessions = db
    .query(
      "select sessions.id from sessions join runs on runs.id = sessions.run_id where runs.feature_id = ? and sessions.status = 'active'"
    )
    .all(featureId) as Array<{ id: string }>;

  for (const session of sessions) {
    db.prepare("update sessions set status='completed', updated_at=? where id=?").run(now(), session.id);
    emitEvent(db, 'session.completed', 'session', session.id, { reason });
  }

  db.close();
}

export function createFeature(input: {
  home?: string;
  projectId: string;
  title: string;
  specText?: string;
  sourceRequestText?: string;
  gherkinText: string;
  gherkinMeta?: Record<string, unknown>;
  id?: string;
}) {
  const project = requireProject(input.projectId, input.home);
  const db = openConfiguredCommandDb(input.home);
  const ts = now();
  const id = input.id ?? randomId('feature');

  db.prepare(
    'insert into features (id,project_id,title,spec_text,source_request_text,gherkin_text,gherkin_meta_json,status,loop_phase,base_target_branch,feature_branch_name,pr_url,pr_number,current_workspace_id,current_run_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    id,
    input.projectId,
    input.title,
    input.specText ?? '',
    input.sourceRequestText ?? '',
    input.gherkinText,
    JSON.stringify(input.gherkinMeta ?? {}),
    'awaiting_scenario_approval',
    'idle',
    project.targetBranch,
    null,
    null,
    null,
    null,
    null,
    ts,
    ts
  );

  emitEvent(db, 'feature.created', 'feature', id, {
    projectId: input.projectId,
    title: input.title,
    baseTargetBranch: project.targetBranch,
  });
  db.close();

  return getFeature(id, input.home)!;
}

export function listFeatures(home?: string): FeatureRecord[] {
  const db = openConfiguredCommandDb(home);
  const rows = db.query('select * from features order by created_at asc').all().map(mapFeatureRow) as FeatureRecord[];
  db.close();

  return rows;
}

export function getFeature(id: string, home?: string): FeatureRecord | null {
  const db = openConfiguredCommandDb(home);
  const row = mapFeatureRow(db.query('select * from features where id = ?').get(id));
  db.close();

  return row;
}

export function updateFeature(input: {
  home?: string;
  id: string;
  title?: string;
  specText?: string;
  sourceRequestText?: string;
  gherkinText?: string;
  gherkinMeta?: Record<string, unknown>;
  prUrl?: string | null;
  prNumber?: number | null;
  featureBranchName?: string | null;
}) {
  const current = getFeature(input.id, input.home);

  if (!current) {
    throw new Error(`Feature not found: ${input.id}`);
  }

  if (current.currentRunId && (input.specText || input.gherkinText || input.gherkinMeta)) {
    throw new Error('Cannot change feature contract while a run is active');
  }

  const db = openConfiguredCommandDb(input.home);
  db.prepare(
    'update features set title=?, spec_text=?, source_request_text=?, gherkin_text=?, gherkin_meta_json=?, pr_url=?, pr_number=?, feature_branch_name=?, updated_at=? where id=?'
  ).run(
    input.title ?? current.title,
    input.specText ?? current.specText,
    input.sourceRequestText ?? current.sourceRequestText,
    input.gherkinText ?? current.gherkinText,
    JSON.stringify(input.gherkinMeta ?? JSON.parse(current.gherkinMetaJson || '{}')),
    input.prUrl === undefined ? current.prUrl : input.prUrl,
    input.prNumber === undefined ? current.prNumber : input.prNumber,
    input.featureBranchName === undefined ? current.featureBranchName : input.featureBranchName,
    now(),
    input.id
  );

  emitEvent(db, 'feature.updated', 'feature', input.id, input);
  db.close();

  return getFeature(input.id, input.home);
}

export function approveFeature(id: string, home?: string) {
  const current = getFeature(id, home);

  if (!current) {
    throw new Error(`Feature not found: ${id}`);
  }

  const db = openConfiguredCommandDb(home);
  db.prepare('update features set status=?, loop_phase=?, updated_at=? where id=?').run(
    'active',
    'idle',
    now(),
    id
  );

  emitEvent(db, 'feature.approved', 'feature', id, { approvedFor: 'implementation' });
  db.close();

  ensurePhaseTask(getFeature(id, home)!, 'implementation', home);
  return getFeature(id, home);
}

export function cancelFeature(id: string, home?: string) {
  const current = getFeature(id, home);

  if (!current) {
    throw new Error(`Feature not found: ${id}`);
  }

  completeActiveSessionsForFeature(id, home);

  const db = openConfiguredCommandDb(home);

  db.prepare('update features set status=?, loop_phase=?, current_run_id=?, updated_at=? where id=?').run(
    'canceled',
    'blocked',
    null,
    now(),
    id
  );
  db.prepare(
    "update tasks set status='canceled', updated_at=? where feature_id=? and status not in ('completed','failed','canceled')"
  ).run(now(), id);

  if (current.currentRunId) {
    db.prepare("update runs set status='canceled', updated_at=? where id=?").run(now(), current.currentRunId);
  }

  emitEvent(db, 'feature.canceled', 'feature', id, {
    closedPr: Boolean(current.prUrl),
    deletedFeatureBranch: Boolean(current.featureBranchName),
  });
  db.close();

  if (current.currentWorkspaceId) {
    cleanupWorkspace(current.currentWorkspaceId, home, 'feature_canceled');
  }

  return getFeature(id, home);
}
