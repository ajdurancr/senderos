import { requireLifecycle } from '../../lifecycle/errors';
import type { SenderoGraph, SenderoNodeRecord } from '../../shared/types';

export function jsonObject(value: unknown, label: string): Record<string, unknown> {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { throw new Error(`${label} must be valid JSON`); }
  }
  requireLifecycle(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed), 'INVALID_INPUT', `${label} must be an object`);
  return parsed as Record<string, unknown>;
}

export function completionPolicy(value: unknown) {
  const policy = jsonObject(value, 'Completion policy');
  requireLifecycle(Object.keys(policy).every(key => ['requireReview', 'evidenceKinds'].includes(key)), 'INVALID_INPUT', 'Unsupported completion policy field');
  requireLifecycle(policy.requireReview === undefined || typeof policy.requireReview === 'boolean', 'INVALID_INPUT', 'requireReview must be a boolean');
  requireLifecycle(policy.evidenceKinds === undefined || (Array.isArray(policy.evidenceKinds) && policy.evidenceKinds.every(kind => ['test', 'ci', 'pull_request', 'artifact', 'manual'].includes(kind))), 'INVALID_INPUT', 'Invalid completion evidence kind');
  return policy;
}

export function requirementsPolicy(value: unknown): string[] {
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { throw new Error('Requirements must be valid JSON'); }
  }
  requireLifecycle(Array.isArray(parsed) && parsed.every(item => typeof item === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(item)), 'INVALID_INPUT', 'Requirements must be a list of nonempty capability identifiers using letters, numbers, dots, underscores, colons, or hyphens');
  return [...new Set(parsed as string[])];
}

/** Promote a legacy source-edge execution policy before changing its topology. */
export function preservedNodePolicy(graph: Pick<SenderoGraph, 'edges'>, node: SenderoNodeRecord) {
  if (node.executionObjective !== null) return {
    executionObjective: node.executionObjective,
    completionJson: node.completionJson,
    requirementsJson: node.requirementsJson,
  };
  const outgoing = graph.edges.filter(edge => edge.sourceNodeId === node.id && edge.status === 'active');
  if (node.kind !== 'agent' || outgoing.length === 0) return {
    executionObjective: node.executionObjective,
    completionJson: node.completionJson,
    requirementsJson: node.requirementsJson,
  };
  const policies = outgoing.map(edge => {
    const condition = jsonObject(edge.conditionJson, 'Connection condition');
    return {
      executionObjective: edge.transitionObjective,
      completionJson: JSON.stringify(completionPolicy(condition.completion ?? {})),
      requirementsJson: node.requirementsJson,
    };
  });
  requireLifecycle(policies.every(policy => JSON.stringify(policy) === JSON.stringify(policies[0])), 'INVALID_WORKFLOW', 'Legacy outgoing execution policies conflict; set an explicit node objective and completion policy before editing topology');
  return policies[0]!;
}
