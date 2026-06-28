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
  ).run(id, featureId, null, null, rootPath, 'allocated', `senderos/${featureId}`, null, now(), now());

  emitEvent(db, 'workspace.allocated', 'workspace', id, {
    featureId,
    rootPath,
  });

  db.close();
  return { id, rootPath };
}

function createRunRecord(
  featureId: string,
  taskId: string,
  phase: LoopPhase,
  instruction: unknown,
  home?: string
) {
  const db = openConfiguredCommandDb(home);
  const id = randomId('run');

  db.prepare(
    'insert into runs (id,feature_id,task_id,phase,status,instruction_json,result_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?)'
  ).run(id, featureId, taskId, phase, 'queued', JSON.stringify(instruction), '{}', now(), now());

  emitEvent(db, 'run.created', 'run', id, {
    featureId,
    taskId,
    phase,
  });

  db.close();
  return id;
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

  const runId = createRunRecord(feature.id, task.id, phase, instruction, home);
  const { config } = resolveRuntime(home);
  const sessionId = createSession(runId, config.defaultHarness, phase, home);

  const db = openConfiguredCommandDb(home);
  db.prepare('update workspaces set run_id=?, session_id=?, status=?, updated_at=? where id=?').run(
    runId,
    sessionId,
    phase === 'implementation' ? 'active' : 'locked',
    now(),
    workspace.id
  );

  db.prepare(
    'update features set status=?, loop_phase=?, current_workspace_id=?, current_run_id=?, updated_at=? where id=?'
  ).run(statusForPhase(phase), phase, workspace.id, runId, now(), feature.id);

  db.prepare("update runs set status='running', updated_at=? where id=?").run(now(), runId);

  emitEvent(db, 'dispatch.completed', 'feature', feature.id, {
    runId,
    sessionId,
    taskId: task.id,
    phase,
  });

  db.close();

  return {
    feature,
    run: getRun(runId, home),
    session: getSession(sessionId, home),
    task: getTask(task.id, home),
  };
}
