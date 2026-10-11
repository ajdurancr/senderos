import { eq } from 'drizzle-orm';
import { atomic, openRuntimeDb } from '../../db/client';
import { senderoNodes, senderoEdges } from '../../db/schema';
import { requireLifecycle } from '../../lifecycle/errors';
import { requireDraft } from '../../lifecycle/versions';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import type { SenderoNodeRecord, SenderoEdgeRecord } from '../../shared/types';
import { completionPolicy, preservedNodePolicy, requirementsPolicy } from './definition-input';

export async function updateSenderoNode(input: {
  id: string;
  expectedRevision?: string;
  label?: string;
  positionX?: number;
  positionY?: number;
  executionObjective?: string;
  completion?: { requireReview?: boolean; evidenceKinds?: string[] };
  requirements?: string[];
  joinForkNodeId?: string | null;
  home?: string;
}) {
  return atomic(input.home, async () => {
    const db = openRuntimeDb(input.home);
    const node = (await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id)))[0];
    requireLifecycle(node, 'NOT_FOUND', `Sendero node not found: ${input.id}`);
    await requireDraft(node.senderoVersionId, input.home, input.expectedRevision);
    requireLifecycle(input.label === undefined || input.label.trim().length > 0, 'INVALID_INPUT', 'Node label must not be empty');
    requireLifecycle(input.executionObjective === undefined || (node.kind === 'agent' && input.executionObjective.trim().length > 0), 'INVALID_INPUT', 'Execution objectives belong to agent nodes and must not be empty');
    requireLifecycle((input.positionX === undefined || Number.isFinite(input.positionX)) && (input.positionY === undefined || Number.isFinite(input.positionY)), 'INVALID_INPUT', 'Node positions must be finite numbers');
    if (input.joinForkNodeId) {
      const fork = (await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.joinForkNodeId)))[0];
      requireLifecycle(fork?.senderoVersionId === node.senderoVersionId && fork.id !== node.id, 'INVALID_INPUT', 'Join fork must be another node in this Sendero version');
    }
    const promoteLegacy = node.executionObjective === null && (input.executionObjective !== undefined || input.completion !== undefined);
    const baseline = promoteLegacy && !(input.executionObjective !== undefined && input.completion !== undefined)
      ? preservedNodePolicy({ edges: await db.select().from(senderoEdges).where(eq(senderoEdges.senderoVersionId, node.senderoVersionId)) as SenderoEdgeRecord[] }, node as SenderoNodeRecord)
      : node;
    await db.update(senderoNodes).set({
      label: input.label ?? node.label,
      positionX: input.positionX ?? node.positionX, positionY: input.positionY ?? node.positionY,
      executionObjective: input.executionObjective ?? baseline.executionObjective,
      completionJson: input.completion === undefined ? baseline.completionJson : JSON.stringify(completionPolicy(input.completion)),
      requirementsJson: input.requirements === undefined ? node.requirementsJson : JSON.stringify(requirementsPolicy(input.requirements)),
      joinForkNodeId: input.joinForkNodeId === undefined ? node.joinForkNodeId : input.joinForkNodeId,
      updatedAt: now(),
    }).where(eq(senderoNodes.id, input.id));
    await emitEvent(db, 'sendero.node-updated', 'sendero-node', input.id, { label: input.label });
    return (await db.select().from(senderoNodes).where(eq(senderoNodes.id, input.id)))[0]!;
  });
}
