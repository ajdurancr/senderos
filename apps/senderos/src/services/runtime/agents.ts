import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import type { Database } from 'bun:sqlite';

import { openRuntimeDb } from '../../db/client';
import { mapAgentRow, mapAgentRunRow, mapSenderoRow } from '../../db/mappers';
import type {
  AgentKind,
  AgentRecord,
  AgentRunRecord,
  HarnessKind,
  SeedAgentsOptions,
  SenderoGoalMode,
  SenderoRecord,
} from '../../domain/types';
import { now, randomId } from '../../utils/common';
import { emitEvent } from '../events';

function titleFromSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');
}

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

  const record: SenderoRecord = {
    id: randomId('sendero'),
    sourceAgentId: agent.id,
    targetAgentId: null,
    name: 'default sendero',
    description: `Default terminal sendero assigned to ${agent.slug}.`,
    status: 'active',
    goal: agent.defaultGoal ?? defaultGoalFromSlug(agent.slug),
    goalMode: 'terminal',
    assignmentMetaJson: JSON.stringify({ seeded: true, builtIn: true, default: true }),
    createdAt: now(),
    updatedAt: now(),
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
    goalMode: record.goalMode,
  });

  return record;
}

export function builtInAgentDefinitionsDir() {
  return resolve(process.cwd(), 'agents');
}

export function seedBuiltInAgents(home?: string, options: SeedAgentsOptions = {}) {
  const definitionsDir = resolve(options.definitionsDir ?? builtInAgentDefinitionsDir());
  const db = openRuntimeDb(home);
  const seeded: AgentRecord[] = [];

  for (const entry of readdirSync(definitionsDir, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name) !== '.md') {
      continue;
    }

    const absolutePath = join(definitionsDir, entry.name);
    const slug = basename(entry.name, '.md');
    const body = readFileSync(absolutePath, 'utf8');
    const existing = mapAgentRow(db.query('select * from agents where slug = ?').get(slug));
    const timestamp = now();
    const relativeSourcePath = relative(process.cwd(), absolutePath);

    if (existing) {
      db.prepare(
        `update agents
         set name=?, description=?, kind=?, status='active', source_path=?, definition_format='markdown', definition_body=?, default_goal=?, updated_at=?
         where id=?`
      ).run(
        titleFromSlug(slug),
        `Seeded built-in agent from ${entry.name}`,
        inferAgentKind(slug),
        relativeSourcePath,
        body,
        defaultGoalFromSlug(slug),
        timestamp,
        existing.id
      );

      const updated = mapAgentRow(db.query('select * from agents where id = ?').get(existing.id))!;
      seeded.push(updated);
      ensureDefaultSendero(db, updated);
      emitEvent(db, 'agent.seeded', 'agent', updated.id, {
        slug: updated.slug,
        sourcePath: updated.sourcePath,
      });
      continue;
    }

    const record: AgentRecord = {
      id: randomId('agent'),
      slug,
      name: titleFromSlug(slug),
      description: `Seeded built-in agent from ${entry.name}`,
      kind: inferAgentKind(slug),
      status: 'active',
      sourcePath: relativeSourcePath,
      definitionFormat: 'markdown',
      definitionBody: body,
      defaultGoal: defaultGoalFromSlug(slug),
      defaultMetaJson: JSON.stringify({ seeded: true, builtIn: true }),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    db.prepare(
      `insert into agents
      (id,slug,name,description,kind,status,source_path,definition_format,definition_body,default_goal,default_meta_json,created_at,updated_at)
      values (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      record.id,
      record.slug,
      record.name,
      record.description,
      record.kind,
      record.status,
      record.sourcePath,
      record.definitionFormat,
      record.definitionBody,
      record.defaultGoal,
      record.defaultMetaJson,
      record.createdAt,
      record.updatedAt
    );

    seeded.push(record);
    ensureDefaultSendero(db, record);
    emitEvent(db, 'agent.seeded', 'agent', record.id, { slug: record.slug, sourcePath: record.sourcePath });
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

export function listSenderosForAgent(agentId: string, home?: string) {
  const db = openRuntimeDb(home);
  const rows = db
    .query('select * from senderos where source_agent_id=? order by created_at asc')
    .all(agentId)
    .map(mapSenderoRow) as SenderoRecord[];
  db.close();
  return rows;
}

export function createAgentRun(input: {
  agentId: string;
  senderoId?: string | null;
  targetAgentId?: string | null;
  featureId?: string | null;
  runId?: string | null;
  goal: string;
  status?: AgentRunRecord['status'];
  harness: HarnessKind;
  hostEnvironmentName?: string | null;
  hostEnvironmentSessionId?: string | null;
  checkpoint?: string | null;
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
  const record: AgentRunRecord = {
    id: randomId('agent-run'),
    agentId: input.agentId,
    senderoId: input.senderoId ?? null,
    targetAgentId: input.targetAgentId ?? null,
    featureId: input.featureId ?? null,
    runId: input.runId ?? null,
    status: input.status ?? 'queued',
    goal: input.goal,
    hostEnvironmentName: input.hostEnvironmentName ?? null,
    hostEnvironmentSessionId: input.hostEnvironmentSessionId ?? null,
    harness: input.harness,
    checkpoint: input.checkpoint ?? null,
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
    `insert into agent_runs
    (id,agent_id,sendero_id,target_agent_id,feature_id,run_id,status,goal,host_environment_name,host_environment_session_id,harness,checkpoint,status_snapshot_json,result_json,failure_summary,debug_meta_json,started_at,finished_at,created_at,updated_at)
    values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    record.id,
    record.agentId,
    record.senderoId,
    record.targetAgentId,
    record.featureId,
    record.runId,
    record.status,
    record.goal,
    record.hostEnvironmentName,
    record.hostEnvironmentSessionId,
    record.harness,
    record.checkpoint,
    record.statusSnapshotJson,
    record.resultJson,
    record.failureSummary,
    record.debugMetaJson,
    record.startedAt,
    record.finishedAt,
    record.createdAt,
    record.updatedAt
  );

  emitEvent(db, 'agent-run.created', 'agent-run', record.id, {
    agentId: record.agentId,
    senderoId: record.senderoId,
    targetAgentId: record.targetAgentId,
    status: record.status,
  });

  db.close();
  return record;
}

export function listAgentRuns(agentId?: string, home?: string) {
  const db = openRuntimeDb(home);
  const query = agentId
    ? db.query('select * from agent_runs where agent_id=? order by created_at asc')
    : db.query('select * from agent_runs order by created_at asc');
  const rows = (agentId ? query.all(agentId) : query.all()).map(mapAgentRunRow) as AgentRunRecord[];
  db.close();
  return rows;
}

export function getAgentRun(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapAgentRunRow(db.query('select * from agent_runs where id=?').get(id));
  db.close();
  return row;
}
