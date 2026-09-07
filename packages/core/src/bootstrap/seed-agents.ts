import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openRuntimeDb } from '../db/client';
import { mapAgentRow, mapAgentTransitionRow } from '../db/mappers';
import { agents, agentTransitions } from '../db/schema';
import type {
  AgentKind,
  AgentRecord,
  AgentTransitionRecord,
  SeedAgentsOptions,
} from '../shared/types';
import { now, randomId } from '../shared/ids';
import { emitEvent } from '../shared/events';
import { and, eq } from 'drizzle-orm';

const defaultObjective = (slug: string) =>
  `Run ${slug} as a focused agent with one explicit objective.`;
const transitionName = 'default transition';

export function builtInAgentSeedDir() {
  return resolve(dirname(fileURLToPath(import.meta.url)), './agents');
}

async function ensureDefaultTransition(db: ReturnType<typeof openRuntimeDb>, agent: AgentRecord) {
  const existing = mapAgentTransitionRow((await db.select().from(agentTransitions).where(and(eq(agentTransitions.sourceAgentId, agent.id), eq(agentTransitions.name, transitionName))))[0]);
  if (existing) return existing;
  const ts = now();
  const record: AgentTransitionRecord = {
    id: randomId('transition'),
    sourceAgentId: agent.id,
    targetAgentId: null,
    name: transitionName,
    description: `Default transition for ${agent.slug}.`,
    status: 'active',
    transitionObjective: agent.defaultGoal ?? defaultObjective(agent.slug),
    assignmentMetaJson: '{}',
    createdAt: ts,
    updatedAt: ts,
  };
  await db.insert(agentTransitions).values(record);
  await emitEvent(db, 'agent-transition.seeded', 'agent-transition', record.id, {
    sourceAgentId: agent.id,
  });
  return record;
}

export async function seedBuiltInAgents(
  home?: string,
  options: SeedAgentsOptions = {},
) {
  const db = openRuntimeDb(home);
  const seeded: AgentRecord[] = [];
  const definitionsDir = options.definitionsDir ?? builtInAgentSeedDir();
  for (const entry of readdirSync(definitionsDir, { withFileTypes: true })) {
    if (!entry.isFile() || extname(entry.name) !== '.json') continue;
    const raw = JSON.parse(
      readFileSync(resolve(definitionsDir, entry.name), 'utf8'),
    );
    const ts = now();
    const seed = {
      id: raw.id,
      slug: raw.slug ?? basename(entry.name, '.json'),
      name: raw.name,
      description: raw.description ?? '',
      kind: (raw.kind ?? 'system') as AgentKind,
      status: raw.status ?? 'active',
      definitionFormat: raw.definitionFormat ?? 'markdown',
      definitionBody: raw.definitionBody ?? '',
      defaultGoal:
        raw.defaultGoal ??
        defaultObjective(raw.slug ?? basename(entry.name, '.json')),
      defaultMetaJson: raw.defaultMetaJson ?? '{}',
      createdAt: raw.createdAt ?? ts,
      updatedAt: ts,
    };
    const existing = mapAgentRow((await db.select().from(agents).where(eq(agents.slug, seed.slug)))[0]);
    if (existing)
      await db.update(agents).set({ name: seed.name, description: seed.description, kind: seed.kind, status: seed.status, definitionFormat: seed.definitionFormat, definitionBody: seed.definitionBody, defaultGoal: seed.defaultGoal, defaultMetaJson: seed.defaultMetaJson, updatedAt: ts }).where(eq(agents.id, existing.id));
    else
      await db.insert(agents).values(seed);
    const agent = mapAgentRow((await db.select().from(agents).where(eq(agents.slug, seed.slug)))[0])!;
    await ensureDefaultTransition(db, agent);
    seeded.push(agent);
    await emitEvent(db, 'agent.seeded', 'agent', agent.id, { slug: agent.slug });
  }
  return seeded;
}
