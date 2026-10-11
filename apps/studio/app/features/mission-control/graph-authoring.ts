import type { MissionControlData } from './server';

type Graph = MissionControlData['senderoGraphs'][number];
export type DraftNode = {
  key: string; kind: 'start' | 'agent' | 'end'; label: string; agentId?: string;
  positionX: number; positionY: number; executionObjective?: string;
  completionJson: string; requirementsJson: string; joinForkNodeId?: string;
};
export type DraftEdge = {
  key: string; source: string; target: string; name: string; description: string;
  transitionObjective: string; conditionJson: string;
  status: 'active' | 'draft' | 'disabled' | 'archived';
};
export type GraphDraft = { nodes: DraftNode[]; edges: DraftEdge[]; maxActivations: number };

export function objectJson(value: string): Record<string, unknown> {
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}

export function graphDraft(graph: Graph): GraphDraft {
  return {
    maxActivations: 'maxActivations' in graph.version ? Number(graph.version.maxActivations) : 100,
    nodes: graph.nodes.map(node => {
      const edge = graph.edges.find(edge => edge.sourceNodeId === node.id && edge.status === 'active');
      const explicit = 'executionObjective' in node && node.executionObjective !== null;
      const policy = edge ? objectJson(edge.conditionJson).completion : undefined;
      return ({
      key: node.id, kind: node.kind, label: node.label, agentId: node.agentId ?? undefined,
      positionX: node.positionX, positionY: node.positionY,
      executionObjective: explicit ? String(node.executionObjective) : edge?.transitionObjective ?? '',
      completionJson: explicit && 'completionJson' in node ? String(node.completionJson) : JSON.stringify(policy ?? {}),
      requirementsJson: 'requirementsJson' in node ? String(node.requirementsJson) : '[]',
      joinForkNodeId: 'joinForkNodeId' in node ? String(node.joinForkNodeId ?? '') : '',
    }); }),
    edges: graph.edges.map(edge => ({ key: edge.id, source: edge.sourceNodeId, target: edge.targetNodeId,
      name: edge.name, description: edge.description, transitionObjective: edge.transitionObjective,
      conditionJson: edge.conditionJson, status: edge.status })),
  };
}

export function removeDraftNode(draft: GraphDraft, key: string): GraphDraft {
  return { ...draft, nodes: draft.nodes.filter(node => node.key !== key).map(node => ({ ...node, joinForkNodeId: node.joinForkNodeId === key ? '' : node.joinForkNodeId })), edges: draft.edges.filter(edge => edge.source !== key && edge.target !== key) };
}

export function graphDraftErrors(draft: GraphDraft): string[] {
  const errors: string[] = [];
  if (!Number.isSafeInteger(draft.maxActivations) || draft.maxActivations < 1 || draft.maxActivations > 10000) errors.push('Activation budget must be between 1 and 10,000.');
  if (draft.nodes.filter(node => node.kind === 'start').length !== 1) errors.push('Add exactly one start node.');
  if (!draft.nodes.some(node => node.kind === 'end')) errors.push('Add an end node.');
  const keys = new Set(draft.nodes.map(node => node.key));
  for (const node of draft.nodes) {
    if (!node.label.trim()) errors.push('Every node needs a label.');
    if (node.kind === 'agent' && !node.executionObjective?.trim()) errors.push(`Set an execution objective for ${node.label || 'this node'}.`);
    if (node.kind === 'agent' && !node.agentId) errors.push(`Select an agent for ${node.label || 'this node'}.`);
    try {
      const completion = JSON.parse(node.completionJson); const requirements = JSON.parse(node.requirementsJson);
      if (!completion || typeof completion !== 'object' || Array.isArray(completion)) throw new Error();
      if (!Array.isArray(requirements) || requirements.some(value => typeof value !== 'string')) throw new Error();
    } catch { errors.push(`Check the policy JSON for ${node.label || 'this node'}.`); }
    if (node.joinForkNodeId && !keys.has(node.joinForkNodeId)) errors.push(`The join source for ${node.label} is missing.`);
    else if (node.joinForkNodeId && draft.edges.filter(edge => edge.source === node.joinForkNodeId && edge.status === 'active').length < 2) errors.push(`The paired fork for ${node.label} needs at least two active outgoing transitions.`);
  }
  for (const edge of draft.edges) {
    if (!keys.has(edge.source) || !keys.has(edge.target)) errors.push(`Choose existing nodes for ${edge.name || 'this transition'}.`);
    try { const condition = JSON.parse(edge.conditionJson); if (!condition || typeof condition !== 'object' || Array.isArray(condition)) throw new Error(); }
    catch { errors.push(`Check the condition JSON for ${edge.name || 'this transition'}.`); }
  }
  return [...new Set(errors)];
}

export function graphDefinition(draft: GraphDraft) {
  return { ...draft, nodes: draft.nodes.map(node => ({ ...node, agentId: node.kind === 'agent' ? node.agentId : undefined, executionObjective: node.kind === 'agent' ? node.executionObjective : null, joinForkNodeId: node.joinForkNodeId || null })) };
}
