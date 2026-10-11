import { eq } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../../db/client';
import { agents } from '../../db/schema';
import { requirementsPolicy } from '../../internal/senderos/definition-input';
import { requireLifecycle } from '../../lifecycle/errors';
import { emitEvent } from '../../shared/events';
import { now, randomId } from '../../shared/ids';
import type { AgentRecord, AgentStatus } from '../../shared/types';
import { getAgent } from './get';
import { getAgentBySlug } from './get-by-slug';

export interface AgentDefinitionInput {
  slug: string;
  name: string;
  instructions?: string;
  /** Compatibility with exported and bootstrap agent definitions. */
  definitionBody?: string;
  definitionFormat?: string;
  description?: string;
  defaultGoal?: string | null;
  defaultMeta?: Record<string, unknown>;
  status?: AgentStatus;
  home?: string;
}

function validate(input: Partial<AgentDefinitionInput>) {
  if (input.slug !== undefined)
    requireLifecycle(typeof input.slug === 'string' && /^[a-z0-9][a-z0-9._-]*$/.test(input.slug), 'INVALID_INPUT', 'Agent slug must use lowercase letters, numbers, dots, underscores, or hyphens');
  for (const key of ['name', 'instructions', 'definitionBody', 'definitionFormat'] as const)
    if (input[key] !== undefined)
      requireLifecycle(typeof input[key] === 'string' && input[key].trim().length > 0, 'INVALID_INPUT', `Agent ${key} must not be empty`);
  requireLifecycle(input.status === undefined || ['active', 'disabled', 'archived'].includes(input.status), 'INVALID_INPUT', 'Invalid agent status');
  requireLifecycle(input.instructions === undefined || input.definitionBody === undefined || input.instructions === input.definitionBody, 'INVALID_INPUT', 'Use instructions or definitionBody, not conflicting definitions');
  requireLifecycle(input.defaultMeta === undefined || (input.defaultMeta !== null && typeof input.defaultMeta === 'object' && !Array.isArray(input.defaultMeta)), 'INVALID_INPUT', 'Agent defaultMeta must be an object');
  if (input.defaultMeta?.requiredCapabilities !== undefined) {
    requireLifecycle(Array.isArray(input.defaultMeta.requiredCapabilities), 'INVALID_INPUT', 'Agent requiredCapabilities must be an array');
    requirementsPolicy(input.defaultMeta.requiredCapabilities);
  }
}

export async function createAgent(input: AgentDefinitionInput): Promise<AgentRecord> {
  return atomic(input.home, async () => {
    validate(input);
    requireLifecycle(typeof input.slug === 'string' && typeof input.name === 'string', 'INVALID_INPUT', 'Agent slug and name are required');
    const definitionBody = input.instructions ?? input.definitionBody;
    requireLifecycle(definitionBody !== undefined && definitionBody.trim().length > 0, 'INVALID_INPUT', 'Agent instructions are required');
    requireLifecycle(!(await getAgentBySlug(input.slug, input.home)), 'ALREADY_EXISTS', `Agent already exists: ${input.slug}`);
    const ts = now();
    const record: AgentRecord = {
      id: randomId('agent'), slug: input.slug, name: input.name,
      description: input.description ?? '', kind: 'custom', status: input.status ?? 'active',
      definitionFormat: input.definitionFormat ?? 'markdown', definitionBody,
      defaultGoal: input.defaultGoal ?? null, defaultMetaJson: JSON.stringify(input.defaultMeta ?? {}),
      createdAt: ts, updatedAt: ts,
    };
    const db = openRuntimeDb(input.home);
    await db.insert(agents).values(record);
    await emitEvent(db, 'agent.created', 'agent', record.id, { slug: record.slug });
    return record;
  });
}

export async function updateAgent(input: Partial<AgentDefinitionInput> & { id: string }): Promise<AgentRecord> {
  return atomic(input.home, async () => {
    validate(input);
    const current = (await getAgent(input.id, input.home)) ?? (await getAgentBySlug(input.id, input.home));
    requireLifecycle(current, 'NOT_FOUND', `Agent not found: ${input.id}`);
    if (input.slug !== undefined && input.slug !== current.slug)
      requireLifecycle(!(await getAgentBySlug(input.slug, input.home)), 'ALREADY_EXISTS', `Agent already exists: ${input.slug}`);
    const record: AgentRecord = {
      ...current, slug: input.slug ?? current.slug, name: input.name ?? current.name,
      description: input.description ?? current.description, status: input.status ?? current.status,
      definitionFormat: input.definitionFormat ?? current.definitionFormat,
      definitionBody: input.instructions ?? input.definitionBody ?? current.definitionBody,
      defaultGoal: input.defaultGoal === undefined ? current.defaultGoal : input.defaultGoal,
      defaultMetaJson: input.defaultMeta === undefined ? current.defaultMetaJson : JSON.stringify(input.defaultMeta), updatedAt: now(),
    };
    const db = openRuntimeDb(input.home);
    await db.update(agents).set(record).where(eq(agents.id, current.id));
    await emitEvent(db, 'agent.updated', 'agent', current.id, { slug: record.slug });
    return record;
  });
}

export async function upsertAgent(input: AgentDefinitionInput): Promise<AgentRecord> {
  return atomic(input.home, async () => {
    const current = await getAgentBySlug(input.slug, input.home);
    return current ? updateAgent({ ...input, id: current.id }) : createAgent(input);
  });
}
