import type { FeatureRecord } from '../../domain/types';
import { openRuntimeDb } from '../../db/client';
import { mapFeatureRow, mapProjectRow } from '../../db/mappers';
import { now, randomId } from '../../utils/common';
import { emitEvent } from '../events';
import { completeActiveSessionsForFeature } from '../session-lifecycle';

function requireProject(projectId: string, home?: string) {
  const db = openRuntimeDb(home);
  const project = mapProjectRow(db.query('select * from projects where id = ?').get(projectId));
  db.close();

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  return project;
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
  const db = openRuntimeDb(input.home);
  const ts = now();
  const id = input.id ?? randomId('feature');

  db.prepare(
    'insert into features (id,project_id,title,spec_text,source_request_text,gherkin_text,gherkin_meta_json,status,sendero_step,base_target_branch,feature_branch_name,pr_url,pr_number,current_workspace_id,current_run_id,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
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
  const db = openRuntimeDb(home);
  const rows = db.query('select * from features order by created_at asc').all().map(mapFeatureRow) as FeatureRecord[];
  db.close();
  return rows;
}

export function getFeature(id: string, home?: string): FeatureRecord | null {
  const db = openRuntimeDb(home);
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

  const db = openRuntimeDb(input.home);
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

  const db = openRuntimeDb(home);
  db.prepare('update features set status=?, sendero_step=?, updated_at=? where id=?').run('active', 'idle', now(), id);
  emitEvent(db, 'feature.approved', 'feature', id, { approvedFor: 'dispatch' });
  db.close();
  return getFeature(id, home);
}

export function cancelFeature(id: string, home?: string) {
  const current = getFeature(id, home);
  if (!current) {
    throw new Error(`Feature not found: ${id}`);
  }

  completeActiveSessionsForFeature(id, home);
  const db = openRuntimeDb(home);
  db.prepare('update features set status=?, sendero_step=?, current_run_id=?, updated_at=? where id=?').run('canceled', 'blocked', null, now(), id);
  if (current.currentRunId) {
    db.prepare("update runs set status='canceled', updated_at=? where id=?").run(now(), current.currentRunId);
  }
  emitEvent(db, 'feature.canceled', 'feature', id, {
    closedPr: Boolean(current.prUrl),
    deletedFeatureBranch: Boolean(current.featureBranchName),
  });
  db.close();
  return getFeature(id, home);
}
