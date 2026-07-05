import { openRuntimeDb } from '../../../db/client';
import type { FeatureRecord } from '../../../domain/types';
import { now, randomId } from '../../../utils/common';
import { emitEvent } from '../../events';
import { createRunExecution, getAgent, getSendero, getRunExecution, updateRunExecutionByRunId } from '../agents';

export function createRunRecord(feature: FeatureRecord, senderoId: string, previousRunId: string | null, home?: string) {
  const sendero = getSendero(senderoId, home);
  if (!sendero) {
    throw new Error(`Sendero not found: ${senderoId}`);
  }

  const db = openRuntimeDb(home);
  const id = randomId('run');
  db.prepare(
    'insert into runs (id,feature_id,task_id,phase,status,branch_name,base_branch,max_attempts,attempt_count,current_attempt,instruction_json,result_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).run(
    id,
    feature.id,
    null,
    sendero.id,
    'executing',
    null,
    feature.baseTargetBranch,
    3,
    previousRunId ? 1 : 0,
    previousRunId ? 1 : 0,
    JSON.stringify({ senderoId: sendero.id, previousRunId }),
    JSON.stringify({}),
    now(),
    now()
  );
  emitEvent(db, 'run.created', 'run', id, {
    featureId: feature.id,
    senderoId: sendero.id,
    previousRunId,
  });
  db.close();
  return getRun(id, home);
}

export function createSessionRecord(runId: string, home?: string) {
  const db = openRuntimeDb(home);
  const id = randomId('session');
  db.prepare(
    'insert into sessions (id,run_id,harness,external_session_id,status,status_snapshot_json,heartbeat_at,resume_command,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)'
  ).run(id, runId, 'unknown', null, 'active', '{}', now(), `senderos session resume ${id}`, now(), now());
  emitEvent(db, 'session.created', 'session', id, { runId });
  db.close();
  return getSession(id, home);
}

export function createRunExecutionRecord(input: {
  feature: FeatureRecord;
  runId: string;
  sessionId: string;
  senderoId: string;
  agentId: string;
  previousRunId?: string | null;
  home?: string;
}) {
  const sendero = getSendero(input.senderoId, input.home);
  if (!sendero) {
    throw new Error(`Sendero not found: ${input.senderoId}`);
  }
  const agent = getAgent(input.agentId, input.home);
  if (!agent) {
    throw new Error(`Agent not found: ${input.agentId}`);
  }

  if (input.previousRunId) {
    updateRunExecutionByRunId(
      input.previousRunId,
      { status: 'succeeded', checkpoint: 'previous_run_consumed', finishedAt: now() },
      input.home
    );
  }

  const execution = createRunExecution({
    home: input.home,
    runId: input.runId,
    featureId: input.feature.id,
    attemptNumber: input.previousRunId ? 2 : 1,
    agentId: agent.id,
    senderoId: sendero.id,
    targetAgentId: sendero.targetAgentId ?? null,
    status: 'running',
    goal: sendero.goal,
    harness: 'unknown',
    hostEnvironmentName: 'external-host-agent',
    hostEnvironmentSessionId: input.sessionId,
    checkpoint: 'dispatched',
    debugMeta: { previousRunId: input.previousRunId ?? null },
    startedAt: now(),
  });

  return getRunExecution(execution.id, input.home);
}

export function attachRunToFeature(featureId: string, runId: string, home?: string) {
  const db = openRuntimeDb(home);
  db.prepare('update features set status=?, current_run_id=?, updated_at=? where id=?').run('active', runId, now(), featureId);
  db.close();
}

export function getRun(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = db.query('select * from runs where id=?').get(id);
  db.close();
  return row;
}

export function getSession(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = db.query('select * from sessions where id=?').get(id);
  db.close();
  return row;
}
