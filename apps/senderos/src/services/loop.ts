import { join } from 'node:path';
import { ensureDir, resolveRuntime } from '../config/runtime';
import { nextPhase, statusForPhase } from '../domain/constants';
import type { FeatureRecord, LoopPhase, TaskRecord, TaskStatus } from '../domain/types';
import { openDb } from '../db/client';
import { mapTaskRow } from '../db/mappers';
import { now, randomId } from '../utils/common';
import { emitEvent } from './events';

export function defaultInstruction(feature: FeatureRecord, phase: LoopPhase, workspaceRoot?: string) {
  const base = {
    featureId: feature.id,
    featureTitle: feature.title,
    phase,
    workspaceRoot,
    constraints: [
      'Operate only inside the assigned Senderos workspace',
      'Do not mutate Senderos state directly; report results back through Senderos',
      'Return machine-readable execution results',
    ],
  };
  if (phase === 'contract') return { ...base, objective: 'Refine the executable feature contract and acceptance criteria.' };
  if (phase === 'implementation') return { ...base, objective: 'Implement the feature through the TDD loop inside the assigned workspace.' };
  if (phase === 'review') return { ...base, objective: 'Review the implementation, prune issues, and confirm readiness for mutation testing.' };
  if (phase === 'mutation') return { ...base, objective: 'Run the mutation-confidence gate and report survivors or a clean pass.' };
  return { ...base, objective: 'No further work required.' };
}

export function getTask(id: string, home?: string) {
  const db = openDb(home);
  const row = mapTaskRow(db.query('select * from tasks where id=?').get(id));
  db.close();
  return row;
}

export function listTasks(featureId: string, home?: string) {
  const db = openDb(home);
  const rows = db.query('select * from tasks where feature_id=? order by created_at asc').all(featureId).map(mapTaskRow);
  db.close();
  return rows.filter(Boolean) as TaskRecord[];
}

export function updateTaskStatus(taskId: string, status: TaskStatus, result?: unknown, home?: string) {
  const db = openDb(home);
  db.prepare('update tasks set status=?, result_json=?, updated_at=? where id=?').run(status, JSON.stringify(result ?? {}), now(), taskId);
  emitEvent(db, 'task.updated', 'task', taskId, { status, result });
  db.close();
}

export function getWorkspace(id: string, home?: string) {
  const db = openDb(home);
  const row = db.query('select * from workspaces where id=?').get(id);
  db.close();
  return row;
}

export function getRun(id: string, home?: string) {
  const db = openDb(home);
  const row = db.query('select * from runs where id=?').get(id);
  db.close();
  return row;
}

export function getSession(id: string, home?: string) {
  const db = openDb(home);
  const row = db.query('select * from sessions where id=?').get(id);
  db.close();
  return row;
}

export function ensurePhaseTask(feature: FeatureRecord, phase: LoopPhase, home?: string) {
  const db = openDb(home);
  const existing = mapTaskRow(db.query('select * from tasks where feature_id=? and phase=? order by created_at desc limit 1').get(feature.id, phase));
  if (existing) {
    db.close();
    return existing;
  }
  const workspace = feature.currentWorkspaceId ? (getWorkspace(feature.currentWorkspaceId, home) as any) : null;
  const instruction = defaultInstruction(feature, phase, workspace?.root_path);
  const task: TaskRecord = {
    id: randomId('task'),
    featureId: feature.id,
    name: `${phase} task for ${feature.title}`,
    phase,
    status: phase === 'contract' ? 'ready' : 'pending',
    instructionJson: JSON.stringify(instruction),
    resultJson: '{}',
    createdAt: now(),
    updatedAt: now(),
  };
  db.prepare('insert into tasks (id,feature_id,name,phase,status,instruction_json,result_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?)')
    .run(task.id, task.featureId, task.name, task.phase, task.status, task.instructionJson, task.resultJson, task.createdAt, task.updatedAt);
  emitEvent(db, 'task.created', 'task', task.id, { featureId: feature.id, phase });
  db.close();
  return task;
}

function allocateWorkspace(featureId: string, home?: string) {
  const { paths } = resolveRuntime(home);
  const id = randomId('workspace');
  const rootPath = join(paths.workspaceRoot, featureId);
  ensureDir(rootPath);
  const db = openDb(home);
  db.prepare('insert into workspaces (id,feature_id,run_id,session_id,root_path,status,branch_name,retention_reason,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)')
    .run(id, featureId, null, null, rootPath, 'allocated', `senderos/${featureId}`, null, now(), now());
  emitEvent(db, 'workspace.allocated', 'workspace', id, { featureId, rootPath });
  db.close();
  return { id, rootPath };
}

function createRunRecord(featureId: string, taskId: string, phase: LoopPhase, instruction: unknown, home?: string) {
  const db = openDb(home);
  const id = randomId('run');
  db.prepare('insert into runs (id,feature_id,task_id,phase,status,instruction_json,result_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?)')
    .run(id, featureId, taskId, phase, 'queued', JSON.stringify(instruction), '{}', now(), now());
  emitEvent(db, 'run.created', 'run', id, { featureId, taskId, phase });
  db.close();
  return id;
}

function createSession(runId: string, harness: string, phase: LoopPhase, home?: string) {
  const db = openDb(home);
  const id = randomId('session');
  const resumeCommand = `senderos session resume ${id}`;
  db.prepare('insert into sessions (id,run_id,harness,external_session_id,status,status_snapshot_json,heartbeat_at,resume_command,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)')
    .run(id, runId, harness, null, 'active', JSON.stringify({ phase }), now(), resumeCommand, now(), now());
  emitEvent(db, 'session.created', 'session', id, { runId, harness, phase });
  db.close();
  return id;
}

export function dispatchForPhase(feature: FeatureRecord, phase: LoopPhase, home?: string) {
  let workspace = feature.currentWorkspaceId ? (getWorkspace(feature.currentWorkspaceId, home) as any) : null;
  if (!workspace) workspace = allocateWorkspace(feature.id, home);
  const task = ensurePhaseTask({ ...feature, currentWorkspaceId: workspace.id } as FeatureRecord, phase, home);
  const instruction = defaultInstruction({ ...feature, currentWorkspaceId: workspace.id } as FeatureRecord, phase, workspace.root_path);
  updateTaskStatus(task.id, 'running', { dispatchedAt: now() }, home);
  const runId = createRunRecord(feature.id, task.id, phase, instruction, home);
  const { config } = resolveRuntime(home);
  const sessionId = createSession(runId, config.defaultHarness, phase, home);
  const db = openDb(home);
  db.prepare('update workspaces set run_id=?, session_id=?, status=?, updated_at=? where id=?').run(runId, sessionId, phase === 'implementation' ? 'active' : 'locked', now(), workspace.id);
  db.prepare('update features set status=?, loop_phase=?, current_workspace_id=?, current_run_id=?, updated_at=? where id=?').run(statusForPhase(phase), phase, workspace.id, runId, now(), feature.id);
  db.prepare("update runs set status='running', updated_at=? where id=?").run(now(), runId);
  emitEvent(db, 'dispatch.completed', 'feature', feature.id, { runId, sessionId, taskId: task.id, phase });
  db.close();
  return { feature, run: getRun(runId, home), session: getSession(sessionId, home), task: getTask(task.id, home) };
}

export function startLoopForFeature(feature: FeatureRecord, home?: string) {
  const phase = feature.loopPhase === 'idle' ? 'contract' : feature.loopPhase;
  return dispatchForPhase(feature, phase, home);
}

export function tickLoopForFeature(feature: FeatureRecord, home?: string) {
  const currentPhase = feature.loopPhase === 'idle' ? 'contract' : feature.loopPhase;
  const tasks = listTasks(feature.id, home);
  const currentTask = tasks.find((task) => task.phase === currentPhase && task.status === 'running') ?? tasks.find((task) => task.phase === currentPhase);
  if (currentTask && currentTask.status !== 'completed') updateTaskStatus(currentTask.id, 'completed', { completedAt: now() }, home);
  if (feature.currentRunId) {
    const db = openDb(home);
    db.prepare("update runs set status='completed', result_json=?, updated_at=? where id=?").run(JSON.stringify({ phase: currentPhase, completedAt: now() }), now(), feature.currentRunId);
    db.close();
  }
  const next = nextPhase(currentPhase);
  if (next === 'done') {
    const db = openDb(home);
    db.prepare('update features set loop_phase=?, status=?, updated_at=? where id=?').run('done', 'completed', now(), feature.id);
    if (feature.currentWorkspaceId) db.prepare('update workspaces set status=?, updated_at=? where id=?').run('released', now(), feature.currentWorkspaceId);
    if (feature.currentRunId) {
      const session = db.query('select * from sessions where run_id=? order by created_at desc limit 1').get(feature.currentRunId) as any;
      if (session) db.prepare("update sessions set status='completed', updated_at=? where id=?").run(now(), session.id);
    }
    emitEvent(db, 'feature.completed', 'feature', feature.id, {});
    db.close();
    return { feature, run: null, task: null };
  }
  ensurePhaseTask(feature, next, home);
  return dispatchForPhase(feature, next, home);
}
