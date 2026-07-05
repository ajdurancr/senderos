import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import type { Database } from 'bun:sqlite';

import { openRuntimeDb } from '../../db/client';
import { mapAgentRow, mapRunExecutionRow, mapSenderoRow } from '../../db/mappers';
import type {
  AgentKind,
  AgentRecord,
  HarnessKind,
  RunExecutionRecord,
  SeedAgentsOptions,
  SenderoGoalMode,
  SenderoRecord,
} from '../../domain/types';
import { now, randomId } from '../../utils/common';
import { emitEvent } from '../events';

function defaultGoalFromSlug(slug: string) {
  return `Run ${slug} as a focused agent with a single explicit goal.`;
}

function inferAgentKind(_slug: string): AgentKind {
  return 'system';
}

function ensureDefaultSendero(db: Database, agent: AgentRecord) {
  const existing = mapSenderoRow(
    db.query("select * from senderos where source_agent_id=? and name='default sendero' limit 1").get(agent.id)
  );

  if (existing) {
    return existing;
  }

  const ts = now();
  const record: SenderoRecord = {
    id: randomId('sendero'),
    sourceAgentId: agent.id,
    targetAgentId: null,
    name: 'default sendero',
    description: `Default sendero for ${agent.slug}.`,
    status: 'active',
    goal: agent.defaultGoal ?? defaultGoalFromSlug(agent.slug),
    goalMode: 'terminal',
    assignmentMetaJson: '{}',
    createdAt: ts,
    updatedAt: ts,
  };

  db.prepare(
    `insert into senderos
    (id,source_agent_id,target_agent_id,name,description,status,goal,goal_mode,assignment_meta_json,created_at,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    record.id,
    record.sourceAgentId,
    record.targetAgentId,
    record.name,
    record.description,
    record.status,
    record.goal,
    record.goalMode,
    record.assignmentMetaJson,
    record.createdAt,
    record.updatedAt
  );

  emitEvent(db, 'sendero.seeded', 'sendero', record.id, {
    sourceAgentId: record.sourceAgentId,
    name: record.name,
  });

  return record;
}

export function builtInAgentSeedDir() {
  return resolve(process.cwd(), 'db-seeds', 'agents');
}

function normalizeSeedAgent(raw: any, fallbackSlug: string): AgentRecord {
  return {
    id: raw.id,
    slug: raw.slug ?? fallbackSlug,
    name: raw.name,
    description: raw.description ?? '',
    kind: raw.kind ?? inferAgentKind(raw.slug ?? fallbackSlug),
    status: raw.status ?? 'active',
    definitionFormat: raw.definitionFormat ?? 'markdown',
    definitionBody: raw.definitionBody ?? '',
    defaultGoal: raw.defaultGoal ?? defaultGoalFromSlug(raw.slug ?? fallbackSlug),
    defaultMetaJson: raw.defaultMetaJson ?? '{}',
    createdAt: raw.createdAt ?? now(),
    updatedAt: raw.updatedAt ?? now(),
  };
}

export function seedBuiltInAgents(home?: string, options: SeedAgentsOptions = {}) {
  const seedsDir = resolve(options.definitionsDir ?? builtInAgentSeedDir());
  const db = openRuntimeDb(home);
  const seeded: AgentRecord[] = [];

  for (const entry of readdirSync(seedsDir, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name) !== '.json') {
      continue;
    }

    const slug = basename(entry.name, '.json');
    const seed = normalizeSeedAgent(JSON.parse(readFileSync(resolve(seedsDir, entry.name), 'utf8')), slug);
    const existing = mapAgentRow(db.query('select * from agents where slug = ?').get(seed.slug));
    const timestamp = now();

    if (existing) {
      db.prepare(
        `update agents
         set name=?, description=?, kind=?, status=?, definition_format=?, definition_body=?, default_goal=?, default_meta_json=?, updated_at=?
         where id=?`
      ).run(
        seed.name,
        seed.description,
        seed.kind,
        seed.status,
        seed.definitionFormat,
        seed.definitionBody,
        seed.defaultGoal,
        seed.defaultMetaJson,
        timestamp,
        existing.id
      );

      const updated = mapAgentRow(db.query('select * from agents where id = ?').get(existing.id))!;
      seeded.push(updated);
      ensureDefaultSendero(db, updated);
      emitEvent(db, 'agent.seeded', 'agent', updated.id, { slug: updated.slug });
      continue;
    }

    const record: AgentRecord = { ...seed, updatedAt: timestamp };

    db.prepare(
      `insert into agents
      (id,slug,name,description,kind,status,definition_format,definition_body,default_goal,default_meta_json,created_at,updated_at)
      values (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      record.id,
      record.slug,
      record.name,
      record.description,
      record.kind,
      record.status,
      record.definitionFormat,
      record.definitionBody,
      record.defaultGoal,
      record.defaultMetaJson,
      record.createdAt,
      record.updatedAt
    );

    seeded.push(record);
    ensureDefaultSendero(db, record);
    emitEvent(db, 'agent.seeded', 'agent', record.id, { slug: record.slug });
  }

  db.close();
  return seeded;
}

export function listAgents(home?: string) {
  const db = openRuntimeDb(home);
  const rows = db.query('select * from agents order by created_at asc').all().map(mapAgentRow) as AgentRecord[];
  db.close();
  return rows;
}

export function getAgent(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapAgentRow(db.query('select * from agents where id=?').get(id));
  db.close();
  return row;
}

export function getAgentBySlug(slug: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapAgentRow(db.query('select * from agents where slug=?').get(slug));
  db.close();
  return row;
}

export function createSendero(input: {
  sourceAgentId: string;
  targetAgentId?: string | null;
  name: string;
  description?: string;
  goal: string;
  goalMode?: SenderoGoalMode;
  status?: SenderoRecord['status'];
  assignmentMeta?: Record<string, unknown>;
  home?: string;
}) {
  const db = openRuntimeDb(input.home);
  const timestamp = now();
  const record: SenderoRecord = {
    id: randomId('sendero'),
    sourceAgentId: input.sourceAgentId,
    targetAgentId: input.targetAgentId ?? null,
    name: input.name,
    description: input.description ?? '',
    status: input.status ?? 'active',
    goal: input.goal,
    goalMode: input.goalMode ?? (input.targetAgentId ? 'toward_agent' : 'terminal'),
    assignmentMetaJson: JSON.stringify(input.assignmentMeta ?? {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.prepare(
    `insert into senderos
    (id,source_agent_id,target_agent_id,name,description,status,goal,goal_mode,assignment_meta_json,created_at,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    record.id,
    record.sourceAgentId,
    record.targetAgentId,
    record.name,
    record.description,
    record.status,
    record.goal,
    record.goalMode,
    record.assignmentMetaJson,
    record.createdAt,
    record.updatedAt
  );

  emitEvent(db, 'sendero.created', 'sendero', record.id, {
    sourceAgentId: record.sourceAgentId,
    targetAgentId: record.targetAgentId,
    goalMode: record.goalMode,
  });

  db.close();
  return record;
}

export function listSenderos(home?: string) {
  const db = openRuntimeDb(home);
  const rows = db.query('select * from senderos order by created_at asc').all().map(mapSenderoRow) as SenderoRecord[];
  db.close();
  return rows;
}

export function getSendero(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapSenderoRow(db.query('select * from senderos where id=?').get(id));
  db.close();
  return row;
}

export function getDefaultSenderoForAgent(agentId: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapSenderoRow(
    db.query("select * from senderos where source_agent_id=? and name='default sendero' order by created_at asc limit 1").get(agentId)
  );
  db.close();
  return row;
}

export function listSenderosForAgent(agentId: string, home?: string) {
  const db = openRuntimeDb(home);
  const rows = db
    .query('select * from senderos where source_agent_id=? order by created_at asc')
    .all(agentId)
    .map(mapSenderoRow) as SenderoRecord[];
  db.close();
  return rows;
}

export function createRunExecution(input: {
  agentId: string;
  senderoId?: string | null;
  targetAgentId?: string | null;
  featureId?: string | null;
  runId?: string | null;
  goal: string;
  status?: RunExecutionRecord['status'];
  attemptNumber?: number;
  harness: HarnessKind;
  hostEnvironmentName?: string | null;
  hostEnvironmentSessionId?: string | null;
  checkpoint?: string | null;
  sourceFeatureSha?: string | null;
  failureStep?: string | null;
  statusSnapshot?: Record<string, unknown>;
  result?: Record<string, unknown>;
  failureSummary?: string | null;
  debugMeta?: Record<string, unknown>;
  startedAt?: string | null;
  finishedAt?: string | null;
  home?: string;
}) {
  const db = openRuntimeDb(input.home);
  const timestamp = now();
  const record: RunExecutionRecord = {
    id: randomId('run-execution'),
    runId: input.runId ?? null,
    featureId: input.featureId ?? null,
    attemptNumber: input.attemptNumber ?? 1,
    agentId: input.agentId,
    senderoId: input.senderoId ?? null,
    targetAgentId: input.targetAgentId ?? null,
    status: input.status ?? 'queued',
    goal: input.goal,
    hostEnvironmentName: input.hostEnvironmentName ?? null,
    hostEnvironmentSessionId: input.hostEnvironmentSessionId ?? null,
    harness: input.harness,
    checkpoint: input.checkpoint ?? null,
    sourceFeatureSha: input.sourceFeatureSha ?? null,
    failureStep: input.failureStep ?? null,
    statusSnapshotJson: JSON.stringify(input.statusSnapshot ?? {}),
    resultJson: JSON.stringify(input.result ?? {}),
    failureSummary: input.failureSummary ?? null,
    debugMetaJson: JSON.stringify(input.debugMeta ?? {}),
    startedAt: input.startedAt ?? null,
    finishedAt: input.finishedAt ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.prepare(
    `insert into run_executions
    (id,run_id,feature_id,attempt_number,agent_id,sendero_id,target_agent_id,status,goal,host_environment_name,host_environment_session_id,harness,checkpoint,source_feature_sha,failure_step,status_snapshot_json,result_json,failure_summary,debug_meta_json,started_at,finished_at,created_at,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    record.id,
    record.runId,
    record.featureId,
    record.attemptNumber,
    record.agentId,
    record.senderoId,
    record.targetAgentId,
    record.status,
    record.goal,
    record.hostEnvironmentName,
    record.hostEnvironmentSessionId,
    record.harness,
    record.checkpoint,
    record.sourceFeatureSha,
    record.failureStep,
    record.statusSnapshotJson,
    record.resultJson,
    record.failureSummary,
    record.debugMetaJson,
    record.startedAt,
    record.finishedAt,
    record.createdAt,
    record.updatedAt
  );

  emitEvent(db, 'run-execution.created', 'run-execution', record.id, {
    agentId: record.agentId,
    senderoId: record.senderoId,
    targetAgentId: record.targetAgentId,
    status: record.status,
  });

  db.close();
  return record;
}

export function updateRunExecution(
  id: string,
  input: {
    status?: RunExecutionRecord['status'];
    checkpoint?: string | null;
    statusSnapshot?: Record<string, unknown>;
    result?: Record<string, unknown>;
    failureSummary?: string | null;
    debugMeta?: Record<string, unknown>;
    hostEnvironmentName?: string | null;
    hostEnvironmentSessionId?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  },
  home?: string
) {
  const current = getRunExecution(id, home);

  if (!current) {
    throw new Error(`Run execution not found: ${id}`);
  }

  const db = openRuntimeDb(home);
  db.prepare(
    `update run_executions
     set status=?, checkpoint=?, status_snapshot_json=?, result_json=?, failure_summary=?, debug_meta_json=?,
         host_environment_name=?, host_environment_session_id=?, started_at=?, finished_at=?, updated_at=?
     where id=?`
  ).run(
    input.status ?? current.status,
    input.checkpoint ?? current.checkpoint,
    JSON.stringify(input.statusSnapshot ?? JSON.parse(current.statusSnapshotJson ?? '{}')),
    JSON.stringify(input.result ?? JSON.parse(current.resultJson ?? '{}')),
    input.failureSummary ?? current.failureSummary,
    JSON.stringify(input.debugMeta ?? JSON.parse(current.debugMetaJson ?? '{}')),
    input.hostEnvironmentName ?? current.hostEnvironmentName,
    input.hostEnvironmentSessionId ?? current.hostEnvironmentSessionId,
    input.startedAt ?? current.startedAt,
    input.finishedAt ?? current.finishedAt,
    now(),
    id
  );

  emitEvent(db, 'run-execution.updated', 'run-execution', id, {
    status: input.status ?? current.status,
    checkpoint: input.checkpoint ?? current.checkpoint,
  });

  db.close();
  return getRunExecution(id, home);
}

export function getRunExecutionByRunId(runId: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapRunExecutionRow(
    db.query('select * from run_executions where run_id=? order by created_at desc limit 1').get(runId)
  );
  db.close();
  return row;
}

export function updateRunExecutionByRunId(
  runId: string,
  input: {
    status?: RunExecutionRecord['status'];
    checkpoint?: string | null;
    statusSnapshot?: Record<string, unknown>;
    result?: Record<string, unknown>;
    failureSummary?: string | null;
    debugMeta?: Record<string, unknown>;
    hostEnvironmentName?: string | null;
    hostEnvironmentSessionId?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  },
  home?: string
) {
  const row = getRunExecutionByRunId(runId, home);

  if (!row) {
    return null;
  }

  return updateRunExecution(row.id, input, home);
}

export function listRunExecutions(agentId?: string, home?: string) {
  const db = openRuntimeDb(home);
  const query = agentId
    ? db.query('select * from run_executions where agent_id=? order by created_at asc')
    : db.query('select * from run_executions order by created_at asc');
  const rows = (agentId ? query.all(agentId) : query.all()).map(mapRunExecutionRow) as RunExecutionRecord[];
  db.close();
  return rows;
}

export function getRunExecution(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapRunExecutionRow(db.query('select * from run_executions where id=?').get(id));
  db.close();
  return row;
}
