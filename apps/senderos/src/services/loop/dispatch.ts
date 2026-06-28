import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { ensureDir, resolveRuntime } from '../../config/runtime';
import { statusForPhase } from '../../domain/constants';
import type { FeatureRecord, LoopPhase } from '../../domain/types';
import { openConfiguredCommandDb } from '../../db/client';
import { now, randomId } from '../../utils/common';
import { emitEvent } from '../events';
import { defaultInstruction } from './instructions';
import { getRun, getSession, getTask, getWorkspace } from './queries';
import { ensurePhaseTask, updateTaskStatus } from './tasks';
import { getProject } from '../runtime/projects';

const COPY_EXCLUDES = new Set(['.git', '.senderos', 'node_modules', 'coverage', 'dist', 'build']);

function materializeProjectSnapshot(sourceRoot: string, targetRoot: string) {
  ensureDir(targetRoot);

  for (const entry of readdirSync(sourceRoot, { withFileTypes: true })) {
    if (COPY_EXCLUDES.has(entry.name)) {
      continue;
    }

    const sourcePath = join(sourceRoot, entry.name);
    const targetPath = join(targetRoot, entry.name);

    if (entry.isDirectory()) {
      cpSync(sourcePath, targetPath, { recursive: true });
      continue;
    }

    if (entry.isSymbolicLink()) {
      const resolved = resolve(sourceRoot, entry.name);
      const linkTarget = relative(targetRoot, resolved) || resolved;
      symlinkSync(linkTarget, targetPath);
      continue;
    }

    cpSync(sourcePath, targetPath);
  }
}

function allocateWorkspace(feature: FeatureRecord, home?: string) {
  const project = getProject(feature.projectId, home);

  if (!project) {
    throw new Error(`Project not found for feature ${feature.id}: ${feature.projectId}`);
  }

  const { paths } = resolveRuntime(home);
  const id = randomId('workspace');
  const rootPath = join(paths.workspaceRoot, project.id, feature.id);

  rmSync(rootPath, { recursive: true, force: true });
  mkdirSync(rootPath, { recursive: true });
  materializeProjectSnapshot(project.canonicalPath, rootPath);

  const db = openConfiguredCommandDb(home);
  db.prepare(
    'insert into workspaces (id,feature_id,run_id,session_id,root_path,status,branch_name,retention_reason,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)'
  ).run(id, feature.id, null, null, rootPath, 'allocated', null, null, now(), now());

  emitEvent(db, 'workspace.allocated', 'workspace', id, {
    featureId: feature.id,
    projectId: project.id,
    rootPath,
  });

  db.close();
  return { id, rootPath };
}

function completeActiveSessionsForFeature(featureId: string, home?: string) {
  const db = openConfiguredCommandDb(home);
  const activeSessions = db
    .query(
      "select sessions.id from sessions join runs on runs.id = sessions.run_id where runs.feature_id = ? and sessions.status = 'active'"
    )
    .all(featureId) as Array<{ id: string }>;

  for (const session of activeSessions) {
    db.prepare("update sessions set status='completed', updated_at=? where id=?").run(now(), session.id);
    emitEvent(db, 'session.completed', 'session', session.id, { reason: 'phase_transition' });
  }

  db.close();
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

function createSession(runId: string, harness: string, phase: LoopPhase, workspaceRoot: string, home?: string) {
  const db = openConfiguredCommandDb(home);
  const id = randomId('session');
  const resumeCommand = `senderos session resume ${id}`;
  const launchCommand = `cd ${JSON.stringify(workspaceRoot)} && ${harness} exec`;

  db.prepare(
    'insert into sessions (id,run_id,harness,external_session_id,status,status_snapshot_json,heartbeat_at,resume_command,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)'
  ).run(
    id,
    runId,
    harness,
    null,
    'active',
    JSON.stringify({ phase, launchCommand }),
    now(),
    resumeCommand,
    now(),
    now()
  );

  emitEvent(db, 'session.created', 'session', id, {
    runId,
    harness,
    phase,
    launchCommand,
  });

  db.close();
  return id;
}

export function cleanupWorkspace(workspaceId: string, home?: string, retentionReason?: string) {
  const workspace = getWorkspace(workspaceId, home) as any;

  if (!workspace) {
    return;
  }

  if (workspace.root_path && existsSync(workspace.root_path)) {
    rmSync(workspace.root_path, { recursive: true, force: true });
  }

  const db = openConfiguredCommandDb(home);
  db.prepare('update workspaces set status=?, retention_reason=?, updated_at=? where id=?').run(
    'cleaned',
    retentionReason ?? null,
    now(),
    workspaceId
  );
  emitEvent(db, 'workspace.cleaned', 'workspace', workspaceId, { retentionReason: retentionReason ?? null });
  db.close();
}

export function dispatchForPhase(feature: FeatureRecord, phase: LoopPhase, home?: string) {
  completeActiveSessionsForFeature(feature.id, home);

  let workspace = feature.currentWorkspaceId
    ? (getWorkspace(feature.currentWorkspaceId, home) as any)
    : null;

  if (!workspace) {
    workspace = allocateWorkspace(feature, home);
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
  const sessionId = createSession(runRecord.id, config.defaultHarness, phase, workspace.root_path, home);

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
