import { eq, or } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../../db/client';
import { agents, senderos, senderoVersions, senderoNodes, senderoEdges } from '../../db/schema';
import { requireLifecycle } from '../../lifecycle/errors';
import { editableGraph } from '../../lifecycle/versions';
import { completionPolicy, jsonObject, preservedNodePolicy, requirementsPolicy } from '../../internal/senderos/definition-input';
import { emitEvent } from '../../shared/events';
import { now, randomId } from '../../shared/ids';
import type { AgentTransitionStatus, SenderoGraph, SenderoNodeKind } from '../../shared/types';
import { getSenderoGraph } from './get-graph';

export interface SenderoNodeDefinition {
  key?: string;
  id?: string;
  kind: SenderoNodeKind;
  label: string;
  agentId?: string | null;
  agentSlug?: string;
  positionX?: number;
  positionY?: number;
  x?: number;
  y?: number;
  executionObjective?: string | null;
  objective?: string;
  completion?: { requireReview?: boolean; evidenceKinds?: string[] };
  completionJson?: string;
  requirements?: string[];
  requirementsJson?: string;
  joinForkNodeId?: string | null;
}
export interface SenderoEdgeDefinition {
  key?: string;
  id?: string;
  source?: string;
  target?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  name?: string;
  description?: string;
  transitionObjective?: string;
  objective?: string;
  condition?: Record<string, unknown>;
  conditionJson?: string;
  status?: AgentTransitionStatus;
}
export interface SenderoDefinitionInput {
  slug: string;
  name: string;
  description?: string;
  nodes?: SenderoNodeDefinition[];
  edges?: SenderoEdgeDefinition[];
  maxActivations?: number;
  home?: string;
}

function maxActivations(value: number) {
  requireLifecycle(Number.isInteger(value) && value >= 1 && value <= 10000, 'INVALID_INPUT', 'maxActivations must be an integer from 1 to 10000');
  return value;
}

async function definitionRecords(input: { nodes: SenderoNodeDefinition[]; edges: SenderoEdgeDefinition[]; home?: string }, versionId: string, existing?: SenderoGraph) {
  requireLifecycle(Array.isArray(input.nodes) && Array.isArray(input.edges), 'INVALID_INPUT', 'Sendero nodes and edges must be arrays');
  requireLifecycle(input.nodes.every(node => node !== null && typeof node === 'object') && input.edges.every(edge => edge !== null && typeof edge === 'object'), 'INVALID_INPUT', 'Nodes and connections must be definition objects');
  const ts = now();
  const ids = new Map<string, string>();
  const nodeKeys = new Set<string>();
  for (const definition of input.nodes) {
    const key = definition.key ?? definition.id;
    requireLifecycle(typeof key === 'string' && key.length > 0 && !nodeKeys.has(key), 'INVALID_INPUT', 'Every node needs a unique key or id');
    nodeKeys.add(key);
    const current = existing?.nodes.find(node => node.id === definition.id || node.id === key);
    const id = current?.id ?? randomId('sendero-node');
    requireLifecycle(!ids.has(key), 'INVALID_INPUT', 'Node keys and ids must be unique');
    ids.set(key, id);
    if (definition.id) {
      requireLifecycle(!ids.has(definition.id) || ids.get(definition.id) === id, 'INVALID_INPUT', 'Duplicate node id');
      ids.set(definition.id, id);
    }
  }
  requireLifecycle(input.nodes.filter(node => node.kind === 'start').length === 1 && input.nodes.filter(node => node.kind === 'end').length >= 1, 'INVALID_INPUT', 'A Sendero must have exactly one start and at least one end node');
  const nodes: typeof senderoNodes.$inferInsert[] = [];
  for (const definition of input.nodes) {
    requireLifecycle(['start', 'agent', 'end'].includes(definition.kind), 'INVALID_INPUT', 'Invalid node kind');
    requireLifecycle(typeof definition.label === 'string' && definition.label.trim().length > 0, 'INVALID_INPUT', 'Node label is required');
    const key = (definition.key ?? definition.id)!;
    const id = ids.get(key)!;
    const current = existing?.nodes.find(node => node.id === id);
    const hasExplicitPolicy = (definition.executionObjective ?? definition.objective) !== undefined && (definition.completion ?? definition.completionJson) !== undefined;
    const legacy = current ? (hasExplicitPolicy ? { executionObjective: current.executionObjective, completionJson: current.completionJson, requirementsJson: current.requirementsJson } : preservedNodePolicy(existing!, current)) : undefined;
    const agentReference = definition.agentId ?? definition.agentSlug;
    const agent = agentReference ? (await openRuntimeDb(input.home).select().from(agents).where(or(eq(agents.id, agentReference), eq(agents.slug, agentReference))))[0] : undefined;
    requireLifecycle(definition.kind !== 'agent' || agent, 'INVALID_INPUT', `Agent not found for node: ${key}`);
    requireLifecycle(definition.kind === 'agent' || !agentReference, 'INVALID_INPUT', 'Boundary nodes cannot reference agents');
    const importedOutgoing = input.edges.filter(edge => (edge.source ?? edge.sourceNodeId) === key || (definition.id !== undefined && (edge.source ?? edge.sourceNodeId) === definition.id));
    const importedPolicies = importedOutgoing.filter(edge => (edge.status ?? 'active') === 'active').map(edge => ({
      objective: edge.transitionObjective ?? edge.objective,
      completion: jsonObject(edge.condition ?? edge.conditionJson ?? {}, 'Connection condition').completion,
    }));
    const importedPolicy = importedPolicies[0];
    const explicitObjective = definition.executionObjective ?? definition.objective;
    if (definition.kind === 'agent' && explicitObjective === undefined && !legacy)
      requireLifecycle(importedPolicies.every(policy => JSON.stringify(policy) === JSON.stringify(importedPolicy)), 'INVALID_INPUT', 'Imported outgoing execution policies conflict; supply an explicit node objective and completion policy');
    const executionObjective = definition.kind === 'agent'
      ? explicitObjective ?? legacy?.executionObjective ?? importedPolicy?.objective ?? agent?.defaultGoal ?? `Run ${definition.label}.`
      : null;
    requireLifecycle(executionObjective === null || (typeof executionObjective === 'string' && executionObjective.trim().length > 0), 'INVALID_INPUT', 'Agent execution objective must not be empty');
    const positionX = definition.positionX ?? definition.x ?? current?.positionX ?? nodes.length * 260;
    const positionY = definition.positionY ?? definition.y ?? current?.positionY ?? 0;
    requireLifecycle(Number.isFinite(positionX) && Number.isFinite(positionY), 'INVALID_INPUT', 'Node positions must be finite numbers');
    const joinReference = definition.joinForkNodeId;
    requireLifecycle(joinReference === undefined || joinReference === null || ids.has(joinReference), 'INVALID_INPUT', 'Join fork must reference a node in this Sendero');
    nodes.push({
      id, senderoVersionId: versionId, kind: definition.kind, label: definition.label,
      agentId: definition.kind === 'agent' ? agent!.id : null, executionObjective,
      completionJson: JSON.stringify(completionPolicy(
        // A raw legacy export carries an empty node policy while its outgoing edge still owns the gates.
        explicitObjective === undefined && (definition.completionJson === '{}' || definition.completion === undefined && definition.completionJson === undefined)
          ? legacy?.completionJson ?? importedPolicy?.completion ?? definition.completion ?? {}
          : definition.completion ?? definition.completionJson ?? legacy?.completionJson ?? importedPolicy?.completion ?? {},
      )),
      requirementsJson: JSON.stringify(requirementsPolicy(definition.requirements ?? definition.requirementsJson ?? legacy?.requirementsJson ?? [])),
      joinForkNodeId: joinReference === undefined ? current?.joinForkNodeId ?? null : joinReference === null ? null : ids.get(joinReference)!,
      agentSnapshotJson: null, positionX: Math.round(positionX), positionY: Math.round(positionY),
      createdAt: current?.createdAt ?? ts, updatedAt: ts,
    });
  }
  requireLifecycle(new Set(nodes.map(node => node.id)).size === nodes.length, 'INVALID_INPUT', 'Duplicate node id');
  const edgeKeys = new Set<string>();
  const edges: typeof senderoEdges.$inferInsert[] = input.edges.map(definition => {
    const key = definition.key ?? definition.id;
    requireLifecycle(key === undefined || (typeof key === 'string' && key.length > 0 && !edgeKeys.has(key)), 'INVALID_INPUT', 'Connection keys must be unique');
    if (key) edgeKeys.add(key);
    const sourceNodeId = ids.get(definition.source ?? definition.sourceNodeId ?? '');
    const targetNodeId = ids.get(definition.target ?? definition.targetNodeId ?? '');
    requireLifecycle(sourceNodeId && targetNodeId, 'INVALID_INPUT', 'Connections must reference nodes in this Sendero');
    requireLifecycle(definition.status === undefined || ['active', 'draft', 'disabled', 'archived'].includes(definition.status), 'INVALID_INPUT', 'Invalid connection status');
    const current = existing?.edges.find(edge => edge.id === definition.id || edge.id === key);
    return {
      id: current?.id ?? randomId('sendero-edge'), senderoVersionId: versionId, sourceNodeId, targetNodeId,
      name: definition.name ?? current?.name ?? 'Continue', description: definition.description ?? current?.description ?? '',
      transitionObjective: definition.transitionObjective ?? definition.objective ?? current?.transitionObjective ?? '',
      conditionJson: JSON.stringify(jsonObject(definition.condition ?? definition.conditionJson ?? current?.conditionJson ?? {}, 'Connection condition')),
      status: definition.status ?? current?.status ?? 'active', createdAt: current?.createdAt ?? ts, updatedAt: ts,
    };
  });
  requireLifecycle(new Set(edges.map(edge => edge.id)).size === edges.length, 'INVALID_INPUT', 'Duplicate connection id');
  requireLifecycle(nodes.every(node => !node.joinForkNodeId || nodes.some(candidate => candidate.id === node.joinForkNodeId)), 'INVALID_INPUT', 'Join fork must reference a node in this Sendero');
  return { nodes, edges };
}

/** Create an editable definition. Publication explicitly validates the complete graph. */
export async function newSendero(input: SenderoDefinitionInput): Promise<SenderoGraph> {
  return atomic(input.home, async () => {
    requireLifecycle(typeof input.slug === 'string' && /^[a-z0-9][a-z0-9._-]*$/.test(input.slug), 'INVALID_INPUT', 'Sendero slug must use lowercase letters, numbers, dots, underscores, or hyphens');
    requireLifecycle(typeof input.name === 'string' && input.name.trim().length > 0, 'INVALID_INPUT', 'Sendero name is required');
    requireLifecycle(!(await getSenderoGraph(input.slug, undefined, input.home)), 'ALREADY_EXISTS', `Sendero already exists: ${input.slug}`);
    requireLifecycle((input.nodes === undefined) === (input.edges === undefined), 'INVALID_INPUT', 'Supply both nodes and edges');
    const ts = now();
    const senderoId = randomId('sendero');
    const versionId = randomId('sendero-version');
    const records = await definitionRecords({ home: input.home, nodes: input.nodes ?? [
      { key: 'start', kind: 'start', label: 'Start', positionX: 0 },
      { key: 'end', kind: 'end', label: 'End', positionX: 520 },
    ], edges: input.edges ?? [{ source: 'start', target: 'end' }] }, versionId);
    const db = openRuntimeDb(input.home);
    await db.insert(senderos).values({ id: senderoId, slug: input.slug, name: input.name, description: input.description ?? '', status: 'draft', isDefault: false, currentVersion: 1, createdAt: ts, updatedAt: ts });
    await db.insert(senderoVersions).values({ id: versionId, senderoId, version: 1, status: 'draft', maxActivations: maxActivations(input.maxActivations ?? 100), createdAt: ts });
    await db.insert(senderoNodes).values(records.nodes);
    if (records.edges.length) await db.insert(senderoEdges).values(records.edges);
    await emitEvent(db, 'sendero.created', 'sendero', senderoId, { slug: input.slug, version: 1 });
    return (await getSenderoGraph(senderoId, 1, input.home))!;
  });
}

export const importSendero = newSendero;

/** Replace draft topology atomically; version fencing prevents editing a published successor. */
export async function replaceSenderoDraft(input: {
  senderoId: string;
  expectedVersionId: string;
  expectedRevision?: string;
  nodes: SenderoNodeDefinition[];
  edges: SenderoEdgeDefinition[];
  maxActivations?: number;
  home?: string;
}): Promise<SenderoGraph> {
  return atomic(input.home, async () => {
    const graph = await editableGraph(input.senderoId, input.home);
    requireLifecycle(graph.version.id === input.expectedVersionId, 'STALE_VERSION', 'The Sendero draft changed; reload it before saving');
    requireLifecycle(input.expectedRevision === undefined || graph.revision === input.expectedRevision, 'STALE_DRAFT', 'The Sendero definition or its agents changed; reload it before saving');
    const records = await definitionRecords(input, graph.version.id, graph);
    const limit = maxActivations(input.maxActivations ?? graph.version.maxActivations);
    const db = openRuntimeDb(input.home);
    await db.delete(senderoEdges).where(eq(senderoEdges.senderoVersionId, graph.version.id));
    await db.delete(senderoNodes).where(eq(senderoNodes.senderoVersionId, graph.version.id));
    await db.insert(senderoNodes).values(records.nodes);
    if (records.edges.length) await db.insert(senderoEdges).values(records.edges);
    await db.update(senderoVersions).set({ maxActivations: limit }).where(eq(senderoVersions.id, graph.version.id));
    await db.update(senderos).set({ updatedAt: now() }).where(eq(senderos.id, graph.sendero.id));
    await emitEvent(db, 'sendero.draft-replaced', 'sendero', graph.sendero.id, { version: graph.version.version, nodes: records.nodes.length, edges: records.edges.length });
    return (await getSenderoGraph(graph.sendero.id, graph.version.version, input.home))!;
  });
}
