import { join } from 'node:path';

import { ensureDir, resolveRuntime } from '../../config/runtime';
import { statusForPhase } from '../../domain/constants';
import type { FeatureRecord, LoopPhase } from '../../domain/types';
import { openConfiguredCommandDb } from '../../db/client';
import { now, randomId } from '../../utils/common';
import { emitEvent } from '../events';
import { defaultInstruction } from './instructions';
import { getRun, getSession, getTask, getWorkspace } from './queries';
import { ensurePhaseTask, updateTaskStatus } from './tasks';

function allocateWorkspace(featureId: string, home?: string) {
  const { paths } = resolveRuntime(home);
  const id = randomId('workspace');
  const rootPath = join(paths.workspaceRoot, featureId);

  ensureDir(rootPath);

  const db = openConfiguredCommandDb(home);
  db.prepare(
    'insert into workspaces (id,feature_id,run_id,session_id,root_path,status,branch_name,retention_reason,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)'
  ).run(id, featureId, null, null, rootPath, 'allocated', null, null, now(), now());

  emitEvent(db, 'workspace.allocated', 'workspace', id, {
    featureId,
    rootPath,
  });

  db.close();
  return { id, rootPath };
}

function createRunRecord(
  feature: FeatureRecord,
  taskId: string,
  phase: LoopPhase,
  instruction: unknown,
  home?: string
) {
  const db = openConfiguredCommandDb(home);
  const id = randomId('run');
  const branchName = `run/${feature.id}/${id}`;
  const baseBranch = feature.featureBranchName ?? feature.baseTargetBranch;

  db.prepare(
    'insert into runs (id,feature_id,task_id,phase,status,branch_name,base_branch,max_attempts,attempt_count,current_attempt,instruction_json,result_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    id,
    feature.id,
    taskId,
    phase,
    'queued',
    branchName,
    baseBranch,
    3,
    0,
    0,
    JSON.stringify(instruction),
    JSON.stringify({ attempts: [] }),
    now(),
    now()
  );

  emitEvent(db, 'run.created', 'run', id, {
    featureId: feature.id,
    taskId,
    phase,
    branchName,
    baseBranch,
  });

  db.close();
  return { id, branchName };
}

function createSession(runId: string, harness: string, phase: LoopPhase, home?: string) {
  const db = openConfiguredCommandDb(home);
  const id = randomId('session');
  const resumeCommand = `senderos session resume ${id}`;

  db.prepare(
    'insert into sessions (id,run_id,harness,external_session_id,status,status_snapshot_json,heartbeat_at,resume_command,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)'
  ).run(
    id,
    runId,
    harness,
    null,
    'active',
    JSON.stringify({ phase }),
    now(),
    resumeCommand,
    now(),
    now()
  );

  emitEvent(db, 'session.created', 'session', id, {
    runId,
    harness,
    phase,
  });

  db.close();
  return id;
}

export function dispatchForPhase(feature: FeatureRecord, phase: LoopPhase, home?: string) {
  let workspace = feature.currentWorkspaceId
    ? (getWorkspace(feature.currentWorkspaceId, home) as any)
    : null;

  if (!workspace) {
    workspace = allocateWorkspace(feature.id, home);
  }

  const task = ensurePhaseTask(
    { ...feature, currentWorkspaceId: workspace.id } as FeatureRecord,
    phase,
    home
  );

  const instruction = defaultInstruction(
    { ...feature, currentWorkspaceId: workspace.id } as FeatureRecord,
    phase,
    workspace.root_path
  );

  updateTaskStatus(task.id, 'running', { dispatchedAt: now() }, home);

  const runRecord = createRunRecord(feature, task.id, phase, instruction, home);
  const { config } = resolveRuntime(home);
  const sessionId = createSession(runRecord.id, config.defaultHarness, phase, home);

  const db = openConfiguredCommandDb(home);
  db.prepare('update workspaces set run_id=?, session_id=?, status=?, branch_name=?, updated_at=? where id=?').run(
    runRecord.id,
    sessionId,
    phase === 'implementation' ? 'active' : 'locked',
    runRecord.branchName,
    now(),
    workspace.id
  );

  db.prepare(
    'update features set status=?, loop_phase=?, current_workspace_id=?, current_run_id=?, feature_branch_name=coalesce(feature_branch_name, ?), updated_at=? where id=?'
  ).run(
    statusForPhase(phase),
    phase,
    workspace.id,
    runRecord.id,
    feature.featureBranchName ?? `feature/${feature.id}`,
    now(),
    feature.id
  );

  db.prepare("update runs set status='executing', current_attempt=1, attempt_count=1, updated_at=? where id=?").run(now(), runRecord.id);

  emitEvent(db, 'dispatch.completed', 'feature', feature.id, {
    runId: runRecord.id,
    sessionId,
    taskId: task.id,
    phase,
  });

  db.close();

  return {
    feature,
    run: getRun(runRecord.id, home),
    session: getSession(sessionId, home),
    task: getTask(task.id, home),
  };
}
