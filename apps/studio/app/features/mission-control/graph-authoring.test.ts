import { describe, expect, it } from 'vitest';
import { missionControlFixture } from '../../test-support/mission-control-fixture';
import { graphDefinition, graphDraft, graphDraftErrors, objectJson, removeDraftNode } from './graph-authoring';

const graph = missionControlFixture.senderoGraphs[0]!;
describe('graph draft authoring', () => {
  it('promotes legacy objectives and completion gates before topology changes', () => {
    const draft = graphDraft({ ...graph, edges: graph.edges.map(edge => ({ ...edge, conditionJson: JSON.stringify({ outcome: 'accepted', completion: { requireReview: true, evidenceKinds: ['test'] } }) })) });
    const node = draft.nodes.find(node => node.kind === 'agent')!;
    expect(node.executionObjective).toBe('Complete');
    expect(JSON.parse(node.completionJson)).toEqual({ requireReview: true, evidenceKinds: ['test'] });
    const changed = removeDraftNode(draft, 'node-end');
    expect(changed.nodes.find(item => item.key === node.key)).toEqual(node);
    expect(changed.edges).toHaveLength(0);
  });
  it('preserves unrelated node policies when deleting incident edges and clears removed joins', () => {
    const draft = graphDraft(graph);
    draft.nodes[1]!.joinForkNodeId = 'node-start';
    draft.nodes[1]!.requirementsJson = '["browser"]';
    const changed = removeDraftNode(draft, 'node-start');
    expect(changed.nodes[0]!.requirementsJson).toBe('["browser"]');
    expect(changed.nodes[0]!.joinForkNodeId).toBe('');
    expect(changed.edges).toHaveLength(1);
  });
  it('supports backedges and multiple outgoing transitions without rewriting policies', () => {
    const draft = graphDraft(graph);
    draft.edges.push({ ...draft.edges[0]!, key: 'backedge', source: 'node-agent', target: 'node-agent', conditionJson: '{"outcome":"revise"}' });
    expect(graphDraftErrors(draft)).toEqual([]);
    expect(graphDefinition(draft).edges).toEqual(draft.edges);
  });
  it('normalizes boundary agents and optional joins for the public import contract', () => {
    const draft = graphDraft(graph);
    draft.nodes[0]!.agentId = 'agent-1';
    const definition = graphDefinition(draft);
    expect(definition.nodes[0]).toMatchObject({ agentId: undefined, executionObjective: null, joinForkNodeId: null });
  });
  it('reports malformed policy, routing, missing nodes, missing objectives, and invalid budgets', () => {
    const draft = graphDraft(graph);
    draft.maxActivations = 0;
    draft.nodes[1] = { ...draft.nodes[1]!, label: '', agentId: '', executionObjective: '', completionJson: '[]', requirementsJson: '[4]', joinForkNodeId: 'missing' };
    draft.edges[0] = { ...draft.edges[0]!, source: 'missing', conditionJson: 'bad' };
    expect(graphDraftErrors(draft).length).toBeGreaterThan(5);
    expect(graphDraftErrors({ ...draft, nodes: [] })).toContain('Add exactly one start node.');
    expect(graphDraftErrors({ ...draft, nodes: [] })).toContain('Add an end node.');
    expect(objectJson('invalid')).toEqual({});
    expect(objectJson('null')).toEqual({});
    expect(objectJson('[]')).toEqual({});
  });
});
