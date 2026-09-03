import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRuntimeDb } from '../../db/client';
import { mapAgentRow, mapAgentTransitionRow } from '../../db/mappers';
import type { AgentKind, AgentRecord, AgentTransitionRecord, SeedAgentsOptions } from '../../shared/types';
import { now, randomId } from '../../shared/ids';
import { emitEvent } from '../../shared/events';

const defaultObjective = (slug: string) => `Run ${slug} as a focused agent with one explicit objective.`;
const transitionName = 'default transition';

export function builtInAgentSeedDir() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../../db-seeds/agents');
}

function ensureDefaultTransition(db: any, agent: AgentRecord) {
  const existing = mapAgentTransitionRow(db.query('select * from agent_transitions where source_agent_id=? and name=?').get(agent.id, transitionName));
  if (existing) return existing;
  const ts = now();
  const record: AgentTransitionRecord = {
    id: randomId('transition'), sourceAgentId: agent.id, targetAgentId: null,
    name: transitionName, description: `Default transition for ${agent.slug}.`,
    status: 'active', transitionObjective: agent.defaultGoal ?? defaultObjective(agent.slug),
    assignmentMetaJson: '{}', createdAt: ts, updatedAt: ts,
  };
  db.prepare('insert into agent_transitions (id,source_agent_id,target_agent_id,name,description,status,transition_objective,assignment_meta_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?)').run(
    record.id, record.sourceAgentId, record.targetAgentId, record.name, record.description,
    record.status, record.transitionObjective, record.assignmentMetaJson, ts, ts,
  );
  emitEvent(db, 'agent-transition.seeded', 'agent-transition', record.id, { sourceAgentId: agent.id });
  return record;
}

export function seedBuiltInAgents(home?: string, options: SeedAgentsOptions = {}) {
  const db = openRuntimeDb(home);
  const seeded: AgentRecord[] = [];
  const definitionsDir = options.definitionsDir ?? builtInAgentSeedDir();
  for (const entry of readdirSync(definitionsDir, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name) !== '.json') continue;
    const raw = JSON.parse(readFileSync(resolve(definitionsDir, entry.name), 'utf8'));
    const ts = now();
    const seed = {
      id: raw.id, slug: raw.slug ?? basename(entry.name, '.json'), name: raw.name,
      description: raw.description ?? '', kind: (raw.kind ?? 'system') as AgentKind,
      status: raw.status ?? 'active', definitionFormat: raw.definitionFormat ?? 'markdown',
      definitionBody: raw.definitionBody ?? '',
      defaultGoal: raw.defaultGoal ?? defaultObjective(raw.slug ?? basename(entry.name, '.json')),
      defaultMetaJson: raw.defaultMetaJson ?? '{}', createdAt: raw.createdAt ?? ts, updatedAt: ts,
    };
    const existing = mapAgentRow(db.query('select * from agents where slug=?').get(seed.slug));
    if (existing) db.prepare('update agents set name=?,description=?,kind=?,status=?,definition_format=?,definition_body=?,default_goal=?,default_meta_json=?,updated_at=? where id=?').run(
      seed.name, seed.description, seed.kind, seed.status, seed.definitionFormat, seed.definitionBody,
      seed.defaultGoal, seed.defaultMetaJson, ts, existing.id,
    );
    else db.prepare('insert into agents (id,slug,name,description,kind,status,definition_format,definition_body,default_goal,default_meta_json,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?)').run(
      seed.id, seed.slug, seed.name, seed.description, seed.kind, seed.status, seed.definitionFormat,
      seed.definitionBody, seed.defaultGoal, seed.defaultMetaJson, seed.createdAt, ts,
    );
    const agent = mapAgentRow(db.query('select * from agents where slug=?').get(seed.slug))!;
    ensureDefaultTransition(db, agent);
    seeded.push(agent);
    emitEvent(db, 'agent.seeded', 'agent', agent.id, { slug: agent.slug });
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
