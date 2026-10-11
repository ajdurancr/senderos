import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useParams, type ActionFunctionArgs } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { missionControlFixture } from '../../../test-support/mission-control-fixture';
import { AgentAuthoring } from './agent-authoring';
import { SenderoCreation, SenderoGraphEditor } from './sendero-authoring';
import { MissionControlOverview } from '../overview';
import { parseStudioPath } from '../navigation';
import { ContextualInspector } from './contextual-inspector';
import { OrchestrationCanvas } from './orchestration-canvas';
import { DispatchTray } from './dispatch-tray';
import { HostExecutionRecords, GoalActivations, executionPhase } from './execution-records';

afterEach(cleanup);

const base = missionControlFixture;
const graph = { ...base.senderoGraphs[0]!, version: { ...base.senderoGraphs[0]!.version, status: 'draft' as const } };
function renderRouter(element: React.ReactNode, handler?: (args: ActionFunctionArgs) => Promise<unknown>) {
  const action = vi.fn(handler ?? (async (_args: ActionFunctionArgs) => null));
  const router = createMemoryRouter([{ path: '*', action, element }], { initialEntries: ['/senderos/sendero-1'] });
  return { ...render(<RouterProvider router={router} />), router, action };
}

describe('Studio authoring interactions', () => {
  it('adds and removes nodes and transitions, then cancels without a write', () => {
    const { action, container } = renderRouter(<SenderoGraphEditor graph={graph} agents={base.agents} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));
    expect(screen.getByRole('group', { name: 'New agent' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add transition' }));
    const transition = screen.getByRole('group', { name: 'New transition' });
    const from = within(transition).getByLabelText('From node');
    const to = within(transition).getByLabelText('To node');
    fireEvent.change(from, { target: { value: 'node-agent' } });
    fireEvent.change(to, { target: { value: 'node-agent' } });
    fireEvent.change(within(transition).getByLabelText('Routing condition JSON'), { target: { value: '{"outcome":"revise"}' } });
    const serialized = container.querySelector<HTMLInputElement>('input[name="definition"]')!.value;
    expect(JSON.parse(serialized).edges.at(-1)).toMatchObject({ source: 'node-agent', target: 'node-agent', conditionJson: '{"outcome":"revise"}' });
    fireEvent.click(within(screen.getByRole('group', { name: 'New agent' })).getByRole('button', { name: 'Remove node' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));
    expect(screen.queryByRole('group', { name: 'New transition' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save graph draft' })).toHaveProperty('disabled', true);
    expect(action).not.toHaveBeenCalled();
  });

  it('edits every source-owned node policy and edge field without losing the directed topology', () => {
    const draft = { ...graph, edges: [...graph.edges, { ...graph.edges[0]!, id: 'fork-a', sourceNodeId: 'node-start', targetNodeId: 'node-agent' }, { ...graph.edges[0]!, id: 'fork-b', sourceNodeId: 'node-start', targetNodeId: 'node-end' }] };
    const { container } = renderRouter(<SenderoGraphEditor graph={draft} agents={base.agents} />);
    fireEvent.change(screen.getByLabelText('Maximum activations per goal'), { target: { value: '55' } });
    const node = screen.getByRole('group', { name: 'Agent' });
    fireEvent.change(within(node).getByLabelText('Node label'), { target: { value: 'Research' } });
    fireEvent.change(within(node).getByLabelText('Node kind'), { target: { value: 'end' } });
    fireEvent.change(within(node).getByLabelText('Node kind'), { target: { value: 'agent' } });
    fireEvent.change(within(node).getByLabelText('Agent'), { target: { value: '' } });
    fireEvent.change(within(node).getByLabelText('Agent'), { target: { value: base.agents[0]!.id } });
    fireEvent.change(within(node).getByLabelText('Execution objective'), { target: { value: 'Research with citations' } });
    fireEvent.change(within(node).getByLabelText(/Completion policy JSON/), { target: { value: '{"requireReview":true}' } });
    fireEvent.change(within(node).getByLabelText(/Required capabilities JSON/), { target: { value: '["browser"]' } });
    fireEvent.change(within(node).getByLabelText('Wait for branches from fork'), { target: { value: 'node-start' } });
    const edge = screen.getAllByRole('group', { name: 'Finish' })[0]!;
    fireEvent.change(within(edge).getByLabelText('Transition name'), { target: { value: 'Accepted' } });
    fireEvent.change(within(edge).getByLabelText('Description'), { target: { value: 'The result is accepted' } });
    fireEvent.change(within(edge).getByLabelText(/Legacy transition objective/), { target: { value: 'Keep this compatibility objective' } });
    fireEvent.change(within(edge).getByLabelText('Transition status'), { target: { value: 'disabled' } });
    const result = JSON.parse(container.querySelector<HTMLInputElement>('input[name="definition"]')!.value);
    expect(result.maxActivations).toBe(55);
    expect(result.nodes[1]).toMatchObject({ label: 'Research', executionObjective: 'Research with citations', completionJson: '{"requireReview":true}', requirementsJson: '["browser"]', joinForkNodeId: 'node-start' });
    expect(result.edges[0]).toMatchObject({ name: 'Accepted', description: 'The result is accepted', status: 'disabled' });
    fireEvent.click(within(edge).getByRole('button', { name: 'Remove transition' }));
    expect(screen.queryByRole('group', { name: 'Accepted' })).toBeNull();
  });

  it('blocks publishing and layout writes until graph edits are saved or canceled', async () => {
    const data = { ...base, senderoGraphs: [graph], draftGraphs: [graph] };
    renderRouter(<MissionControlOverview data={data} route={parseStudioPath('/senderos/sendero-1')} search={new URLSearchParams()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Validate & publish draft' })).toHaveProperty('disabled', true));
    expect(screen.getByRole('button', { name: 'Auto layout' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Validate & publish draft' })).toHaveProperty('disabled', false));
  });

  it('renders and drags fresh node IDs immediately across repeated published-to-draft clones', async () => {
    function CloningCanvas() {
      const [version, setVersion] = useState(1);
      const current = {
        ...graph,
        version: { ...graph.version, id: `version-${version}`, version, status: version === 1 ? 'published' as const : 'draft' as const },
        nodes: graph.nodes.map(node => ({ ...node, id: `${node.id}-v${version}` })),
        edges: graph.edges.map(edge => ({ ...edge, sourceNodeId: `${edge.sourceNodeId}-v${version}`, targetNodeId: `${edge.targetNodeId}-v${version}` })),
      };
      return <><button onClick={() => setVersion(value => value + 1)}>Clone next version</button><OrchestrationCanvas data={{ ...base, senderoGraphs: [current] }} senderoId="sendero-1" /></>;
    }
    const { action, container } = renderRouter(<CloningCanvas />);
    for (let version = 2; version <= 4; version += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Clone next version' }));
      const node = screen.getByLabelText('Inspect agent Agent');
      expect(node.style.left).toBe('300px');
      expect(node.getAttribute('href')).toContain(`node-agent-v${version}`);
      expect(container.querySelectorAll('.edge-hit-target')).toHaveLength(1);
      Object.assign(node, { setPointerCapture: () => undefined });
      fireEvent(node, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
      fireEvent(node, new MouseEvent('pointermove', { bubbles: true, clientX: 30, clientY: 40 }));
      fireEvent(node, new MouseEvent('pointerup', { bubbles: true }));
      await waitFor(() => expect(action).toHaveBeenCalledTimes(version - 1));
      const form = await action.mock.calls.at(-1)![0].request.formData();
      expect(form.get('expectedVersionId')).toBe(`version-${version}`);
      expect(JSON.parse(String(form.get('positions')))).toEqual({ [`node-agent-v${version}`]: { x: 320, y: 110 } });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Auto layout' })).toHaveProperty('disabled', false));
    }
  });

  it('renders terminal node results accurately while an active visit takes priority', () => {
    for (const [status, expected] of [['failed', 'failed'], ['succeeded', 'complete'], ['canceled', 'waiting']] as const) {
      const view = renderRouter(<OrchestrationCanvas data={{ ...base, attempts: [{ ...base.attempts[0]!, status }] }} goalId="goal-1" />);
      const node = screen.getByLabelText('Inspect agent Agent');
      expect(node.classList.contains(expected)).toBe(true);
      expect(node.textContent).toContain(status);
      view.unmount();
    }
    const data = { ...base, attempts: [{ ...base.attempts[0]!, id: 'active-visit', status: 'queued' as const }, base.attempts[0]!] };
    renderRouter(<OrchestrationCanvas data={data} goalId="goal-1" />);
    const node = screen.getByLabelText('Inspect agent Agent');
    expect(node.classList.contains('active')).toBe(true);
    expect(node.classList.contains('failed')).toBe(false);
    expect(node.textContent).toContain('1 active');
  });

  it('keeps opposing forward and backedge labels on their distinct curve midpoints', () => {
    const forward = { ...graph.edges[0]!, sourceNodeId: 'node-agent', targetNodeId: 'node-end', name: 'Accepted path' };
    const backward = { ...forward, id: 'revise-edge', sourceNodeId: 'node-end', targetNodeId: 'node-agent', name: 'Revise path' };
    renderRouter(<OrchestrationCanvas data={{ ...base, senderoGraphs: [{ ...graph, edges: [forward, backward] }] }} senderoId="sendero-1" />);
    const accepted = screen.getByText('Accepted path');
    const revise = screen.getByText('Revise path');
    expect(accepted.tagName).toBe('text');
    expect(revise.getAttribute('x')).toBe(accepted.getAttribute('x'));
    expect(Number(accepted.getAttribute('y')) - Number(revise.getAttribute('y'))).toBe(82.5);
  });

  it('handles an interrupted drag without saving, then persists the next completed gesture once', async () => {
    const { action } = renderRouter(<OrchestrationCanvas data={base} senderoId="sendero-1" />);
    const node = screen.getByLabelText('Inspect agent Agent');
    Object.assign(node, { setPointerCapture: () => undefined });
    fireEvent(node, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
    fireEvent(node, new MouseEvent('pointermove', { bubbles: true, clientX: 140, clientY: 140 }));
    fireEvent(node, new MouseEvent('pointercancel', { bubbles: true }));
    expect(node.style.left).toBe('300px');
    expect(action).not.toHaveBeenCalled();
    fireEvent(node, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }));
    fireEvent(node, new MouseEvent('pointermove', { bubbles: true, clientX: 120, clientY: 130 }));
    fireEvent(node, new MouseEvent('pointerup', { bubbles: true }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const form = await action.mock.calls[0]![0].request.formData();
    expect(JSON.parse(String(form.get('positions')))).toEqual({ 'node-agent': { x: 320, y: 110 } });
    expect(form.get('expectedRevision')).toBe(graph.revision);
    fireEvent.click(node);
  });

  it('cancels active drags on Escape, blur, and pagehide, and reports a stale layout rejection', async () => {
    const { action } = renderRouter(<OrchestrationCanvas data={base} senderoId="sendero-1" />, async () => ({ ok: false, message: 'The layout changed elsewhere. Review it again.' }));
    const node = screen.getByLabelText('Inspect agent Agent');
    Object.assign(node, { setPointerCapture: () => undefined });
    for (const cancel of [() => fireEvent.keyDown(window, { key: 'Escape' }), () => fireEvent.blur(window), () => fireEvent(window, new Event('pagehide'))]) {
      fireEvent(node, new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
      fireEvent(node, new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 80 }));
      fireEvent.keyDown(window, { key: 'Shift' });
      cancel();
      fireEvent(node, new MouseEvent('pointerup', { bubbles: true }));
      fireEvent.click(node);
      expect(node.style.left).toBe('300px');
    }
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Auto layout' }));
    expect((await screen.findByRole('alert')).textContent).toContain('layout changed elsewhere');
  });

  it('prevents malformed drafts from submitting and resets after repeated changes', async () => {
    const { action } = renderRouter(<SenderoGraphEditor graph={graph} agents={base.agents} />);
    const transition = screen.getByRole('group', { name: 'Finish' });
    fireEvent.change(within(transition).getByLabelText('Routing condition JSON'), { target: { value: '{bad' } });
    expect(screen.getByRole('alert').textContent).toContain('condition JSON');
    expect(screen.getByRole('button', { name: 'Save graph draft' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add transition' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save graph draft' }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const form = await action.mock.calls[0]![0].request.formData();
    expect(form.get('expectedVersionId')).toBe(graph.version.id);
    expect(JSON.parse(String(form.get('definition'))).edges).toHaveLength(2);
  });

  it('keeps published workflows immutable and offers usable empty authoring states', () => {
    const first = renderRouter(<SenderoGraphEditor graph={base.senderoGraphs[0]!} agents={base.agents} />);
    expect(screen.queryByText('Draft graph editor')).toBeNull(); first.unmount();
    const missing = renderRouter(<AgentAuthoring data={base} agentId="gone" />);
    expect(screen.getByRole('alert').textContent).toContain('no longer available'); missing.unmount();
    renderRouter(<SenderoCreation />);
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/senderos');
    fireEvent.change(screen.getByLabelText('Authoring method'), { target: { value: 'import' } });
    expect(screen.getByRole('button', { name: 'Import draft' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Sendero JSON'), { target: { value: '{"name":"Imported"}' } });
    fireEvent.change(screen.getByLabelText('Authoring method'), { target: { value: 'create' } });
    expect(screen.queryByLabelText('Sendero JSON')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create draft' })).toBeTruthy();
  });

  it('shows empty transitions and unavailable agent selection while authoring', () => {
    renderRouter(<SenderoGraphEditor graph={{ ...graph, edges: [], nodes: graph.nodes.filter(node => node.kind !== 'agent') }} agents={[]} />);
    expect(screen.getByText('No transitions yet. Connect nodes to define routing.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }));
    expect(screen.getByRole('alert').textContent).toContain('Select an agent');
    fireEvent.change(screen.getByLabelText('Maximum activations per goal'), { target: { value: '0' } });
    expect(screen.getByRole('alert').textContent).toContain('Activation budget');
  });

  it('discards canceled native form values before browser history can restore them', () => {
    const { action, unmount } = renderRouter(<AgentAuthoring data={base} agentId="agent-1" />);
    const original = base.agents.find(agent => agent.id === 'agent-1')!;
    for (let iteration = 0; iteration < 2; iteration += 1) {
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Discard this unsaved name' } });
      fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Discard this unsaved instruction' } });
      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'archived' } });
      fireEvent.click(screen.getByRole('link', { name: 'Close agent editor' }));
      expect(screen.getByLabelText('Name')).toHaveProperty('value', original.name);
      expect(screen.getByLabelText('Instructions')).toHaveProperty('value', original.definitionBody);
      expect(screen.getByLabelText('Status')).toHaveProperty('value', original.status);
    }
    expect(action).not.toHaveBeenCalled();
    unmount();
    const creation = renderRouter(<SenderoCreation />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Discard this workflow' } });
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.getByLabelText('Name')).toHaveProperty('value', '');
    fireEvent.change(screen.getByLabelText('Authoring method'), { target: { value: 'import' } });
    fireEvent.change(screen.getByLabelText('Sendero JSON'), { target: { value: '{"name":"Discard imported definition"}' } });
    fireEvent.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Sendero JSON')).toBeNull();
    expect(screen.getByLabelText('Authoring method')).toHaveProperty('value', 'create');
    expect(creation.action).not.toHaveBeenCalled();
  });

  it('submits agent instructions and suppresses repeated clicks while saving', async () => {
    let resolve: (value: null) => void = () => undefined;
    const action = vi.fn(() => new Promise<null>(done => { resolve = done; }));
    renderRouter(<AgentAuthoring data={base} create />, action);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Researcher' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'researcher' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Cite primary sources.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create agent' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving…' })).toHaveProperty('disabled', true));
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(action).toHaveBeenCalledTimes(1);
    resolve(null);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create agent' })).toHaveProperty('disabled', false));
  });

  it('resets the selected agent editor across newer navigation and Back without saving', async () => {
    function Edit() { const { id } = useParams(); return <AgentAuthoring data={base} agentId={id} />; }
    const action = vi.fn(async () => null);
    const router = createMemoryRouter([
      { path: '/agents/new', action, element: <AgentAuthoring data={base} create /> },
      { path: '/agents/:id', action, element: <Edit /> },
    ], { initialEntries: ['/agents/agent-1'] });
    render(<RouterProvider router={router} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Unsaved rename' } });
    await router.navigate('/agents/new');
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(''));
    await router.navigate(-1);
    await waitFor(() => expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Agent One'));
    expect(action).not.toHaveBeenCalled();
  });

  it('submits only the displayed reviewed activation identities and explicit scope', async () => {
    const action = vi.fn(async ({ request }: { request: Request }) => {
      const form = await request.formData();
      expect(JSON.parse(String(form.get('scope')))).toEqual({ executionContextId: 'context-1', projectId: 'project-1' });
      expect(JSON.parse(String(form.get('reviewedItems')))).toEqual([{ ...base.queue.dispatchable[0], previousRunId: 'run-0' }]);
      return null;
    });
    renderRouter(<DispatchTray data={base} scope={{ executionContextId: 'context-1', projectId: 'project-1' }} />, action);
    fireEvent.click(screen.getByRole('button', { name: /Dispatch all/ }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});

describe('parallel execution monitoring', () => {
  it('shows concurrent branches and repeated visits as distinct activations', () => {
    const activation = { id: 'activation-a', goalId: 'goal-1', nodeId: 'node-agent', transitionId: 'edge-1', parentActivationId: 'origin', previousRunId: null, latestRunId: 'run-1', status: 'running', reason: null, attemptsUsed: 1, maxAttempts: 3, revision: 1, scopesJson: '["fork-generation-1"]', inputJson: '{}', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
    const data = { ...base, activations: [activation, { ...activation, id: 'activation-b', latestRunId: 'run-2', createdAt: '2026-01-02' }], runs: [...base.runs, { ...base.runs[0]!, id: 'run-2', activationId: 'activation-b' }], attempts: [...base.attempts, { ...base.attempts[0]!, id: 'attempt-2', runId: 'run-2', status: 'queued' as const }] };
    renderRouter(<GoalActivations data={data} goalId="goal-1" attemptId="attempt-2" />);
    expect(screen.getByText('Agent · visit 1')).toBeTruthy();
    expect(screen.getByText('Agent · visit 2')).toBeTruthy();
    expect(screen.getAllByText('Fork generations: fork-generation-1')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /visit 2/ }).className).toContain('selected');
  });

  it('shows the selected activation decision and explicit execution objective', () => {
    const attempt = { ...base.attempts[0]!, status: 'running' as const, executionObjective: 'Actual selected objective' };
    const graph = { ...base.senderoGraphs[0]!, edges: base.senderoGraphs[0]!.edges.map(edge => ({ ...edge, transitionObjective: '' })) };
    const data = { ...base, attempts: [attempt], historyGraphs: [graph], decisions: [{ goalId: 'goal-1', state: 'running' as const, reason: 'host_claimed', nextAction: 'start', activations: [{ goalId: 'goal-1', activationId: 'activation-1', attemptId: attempt.id, state: 'blocked' as const, reason: 'lease_expired', nextAction: 'reconcile' }] }] };
    renderRouter(<ContextualInspector data={data} goalId="goal-1" attemptId={attempt.id} />);
    expect(screen.getByText('Actual selected objective')).toBeTruthy();
    expect(screen.getByText('Selected activation')).toBeTruthy();
    expect(screen.queryByText(/host claimed/)).toBeNull();
    expect(screen.getByText(/Next: reconcile/)).toBeTruthy();
  });

  it('shows recorded preflight workspace facts, recovery evidence, and unavailable-host fallbacks', () => {
    const attempt = { ...base.attempts[0]!, status: 'running' as const, ownerId: 'unlisted', leaseExpiresAt: '2099-01-01', claimedAt: '2026-01-01', cancellationRequestedAt: '2026-01-02', recoveryOutcome: 'active', recoveryObservedAt: '2026-01-02', preflight: { eligible: false, checkedAt: '2026-01-01', blockers: ['workspace_unavailable'], requiredCapabilities: ['browser'], declaredCapabilities: [], missingCapabilities: ['browser'], declarationOnly: true, workspace: { reference: 'work-research', workingPath: '/srv/research', available: false, verifiedAt: null, secret: 'not-a-rendered-field' } } };
    expect(executionPhase(attempt)).toBe('running (session unverified)');
    const data = { ...base, hosts: [{ id: 'unlisted', name: 'Offline host', executionContextId: 'missing-context', harness: 'codex', capabilitiesJson: 'invalid', enabled: false, lastSeenAt: '', createdAt: '', updatedAt: '' }], events: [{ ...base.events[0]!, entityId: attempt.id, eventType: 'attempt.reconciled', payload: { details: 'Session still active' } }] };
    const view = renderRouter(<HostExecutionRecords data={data} attempt={attempt} />);
    expect(screen.getByText('missing-context')).toBeTruthy();
    expect(screen.getByText('/srv/research')).toBeTruthy();
    expect(screen.getByText(/Session still active/)).toBeTruthy();
    expect(view.container.textContent).not.toContain('not-a-rendered-field');
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText('Not declared')).toBeTruthy();
  });

  it('renders unresolved, blocked, and empty activations with their exact next action', () => {
    const activation = { id: 'activation-wait', goalId: 'goal-1', nodeId: 'removed-node', transitionId: 'edge-1', parentActivationId: null, previousRunId: null, latestRunId: null, status: 'waiting_join', reason: 'waiting_for_join', attemptsUsed: 0, maxAttempts: 3, revision: 2, scopesJson: 'null', inputJson: '{}', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
    const decision = { goalId: 'goal-1', activationId: activation.id, state: 'blocked' as const, reason: 'waiting_for_join', nextAction: 'wait_for_branches' };
    const data = { ...base, senderoGraphs: [], activations: [activation], decisions: [{ ...decision, activations: [decision] }] };
    const first = renderRouter(<GoalActivations data={data} goalId="goal-1" />);
    expect(screen.getByText('removed-node · visit 1')).toBeTruthy();
    expect(screen.getByText('Next: wait for branches')).toBeTruthy();
    expect(screen.getByText('Parent entry')).toBeTruthy();
    first.unmount();
    const second = renderRouter(<GoalActivations data={{ ...base, attempts: [], runs: [], activations: [] }} goalId="goal-1" />);
    expect(screen.getByText('No activations yet. Start the goal to discover ready work.')).toBeTruthy(); second.unmount();
    const third = renderRouter(<GoalActivations data={data} goalId="missing" />);
    expect(third.container.textContent).toBe('');
  });

  it('distinguishes reserved, claimed, started, and terminal records without claim credentials', () => {
    const attempt = { ...base.attempts[0]!, status: 'queued' as const, startedAt: null, ownerId: null };
    expect(executionPhase(attempt)).toBe('reserved');
    expect(executionPhase({ ...attempt, ownerId: 'host' })).toBe('claimed');
    expect(executionPhase({ ...attempt, status: 'running', ownerId: 'host', externalSessionId: 'worker', startedAt: '2026-01-01' })).toBe('started');
    const data = { ...base, hosts: [{ id: 'host', name: 'Research laptop', executionContextId: 'context-1', harness: 'codex', capabilitiesJson: '["browser"]', enabled: true, lastSeenAt: '', createdAt: '', updatedAt: '' }] };
    const view = renderRouter(<HostExecutionRecords data={data} attempt={{ ...attempt, ownerId: 'host', externalSessionId: 'worker', parentSessionId: 'main', leaseExpiresAt: '2026-01-01T00:00:00Z', recoveryOutcome: 'unknown', preflight: { eligible: true, requiredCapabilities: ['browser'], declarationOnly: true } }} />);
    expect(screen.getByText('Research laptop')).toBeTruthy();
    expect(screen.getByText('worker')).toBeTruthy();
    expect(screen.getByText('main')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('expiry does not prove');
    expect(view.container.textContent).not.toContain('token');
  });
});
