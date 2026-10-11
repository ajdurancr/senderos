import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLoaderData } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { missionControlFixture } from '../../test-support/mission-control-fixture';
import { OrchestrationCanvas } from './components/orchestration-canvas';
import { ContextualInspector } from './components/contextual-inspector';
import { AttentionView } from './components/workspace-views';
import { SenderoGraphEditor } from './components/sendero-authoring';
import type { MissionControlData } from './server';

afterEach(cleanup);
const base = missionControlFixture;
const graph = base.senderoGraphs[0]!;
function inRouter(element: React.ReactNode) {
  const router = createMemoryRouter([{ path: '*', action: () => null, element }]);
  return render(<RouterProvider router={router} />);
}

describe('independent Studio audit regressions', () => {
  it('resolves attention links to each record\'s project with no global project filter', () => {
    inRouter(<AttentionView data={base} />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^\/projects\/project-1\//);
    }
  });

  it('keeps definition canvas selection independent of existing project goals', () => {
    inRouter(<OrchestrationCanvas data={base} senderoId={graph.sendero.id} />);
    expect(screen.getByLabelText('Inspect agent Agent').getAttribute('href')).toBe('/senderos/sendero-1/nodes/node-agent');
    expect(screen.getByLabelText('Inspect transition Finish').getAttribute('href')).toBe('/senderos/sendero-1/edges/edge-1');
    expect(screen.queryByText(/LIVE EXECUTION OVERLAY/)).toBeNull();
  });

  it('does not show another node\'s visits when the same agent is reused', () => {
    const repeated = { ...graph, nodes: [...graph.nodes, { ...graph.nodes[1]!, id: 'node-agent-unvisited', label: 'Unvisited task', positionX: 850 }] };
    const data: MissionControlData = {
      ...base, senderoGraphs: [repeated], historyGraphs: [repeated],
      attempts: [{ ...base.attempts[0]!, status: 'running' }],
      activations: [{ id: 'activation-1', goalId: 'goal-1', nodeId: 'node-agent', transitionId: 'edge-1', parentActivationId: null,
        previousRunId: null, latestRunId: 'run-1', status: 'running', reason: null, attemptsUsed: 1, maxAttempts: 3,
        revision: 1, scopesJson: '[]', inputJson: '{}', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
    };
    inRouter(<OrchestrationCanvas data={data} projectId="project-1" goalId="goal-1" />);
    const visited = screen.getByLabelText('Inspect agent Agent');
    const unvisited = screen.getByLabelText('Inspect agent Unvisited task');
    expect(visited.getAttribute('href')).toBe('/projects/project-1/canvas/goals/goal-1/nodes/node-agent/attempts/attempt-1');
    expect(unvisited.getAttribute('href')).toBe('/projects/project-1/canvas/goals/goal-1/nodes/node-agent-unvisited');
    expect(within(visited).getByText('1 visits')).toBeTruthy();
    expect(within(unvisited).getByText('0 visits')).toBeTruthy();
    expect(within(unvisited).queryByText('1 active')).toBeNull();
  });

  it('does not expose mutation forms for an attempt outside the selected goal', () => {
    const data: MissionControlData = {
      ...base,
      goals: [...base.goals, { ...base.goals[0]!, id: 'other-goal' }],
      runs: [...base.runs, { ...base.runs[0]!, id: 'other-run', goalId: 'other-goal' }],
      attempts: [...base.attempts, { ...base.attempts[0]!, id: 'other-attempt', runId: 'other-run', status: 'running' }],
    };
    const { container, unmount } = inRouter(<ContextualInspector data={data} goalId="goal-1" attemptId="other-attempt" />);
    expect([...container.querySelectorAll<HTMLInputElement>('input[name="attemptId"]')].map(input => input.value)).not.toContain('other-attempt');
    expect([...container.querySelectorAll<HTMLInputElement>('input[name="runId"]')].map(input => input.value)).not.toContain('other-run');
    unmount();
    const differentNode = inRouter(<ContextualInspector data={{ ...data, historyGraphs: [graph] }} goalId="goal-1" nodeId="node-end" attemptId="attempt-1" />);
    expect(differentNode.container.querySelector('input[name="attemptId"]')).toBeNull();
    expect(differentNode.container.querySelector('input[name="runId"]')).toBeNull();
  });

  it('preserves dirty edits across revalidation, cancels to the current revision, and resets after repeated saves', async () => {
    let current: MissionControlData['senderoGraphs'][number] = { ...graph, revision: 'initial', version: { ...graph.version, status: 'draft' } };
    function Editor() {
      const data = useLoaderData() as { graph: typeof current };
      return <SenderoGraphEditor graph={data.graph} agents={base.agents} />;
    }
    const action = vi.fn(async ({ request }: { request: Request }) => {
      const submitted = await request.formData();
      if (submitted.get('expectedRevision') !== current.revision) return { ok: false, intent: 'replace-sendero-draft' };
      const input = JSON.parse(String(submitted.get('definition'))) as { nodes: Array<{ key: string; label: string }> };
      current = { ...current, revision: `${current.revision}-saved`, nodes: current.nodes.map(node => ({ ...node, label: input.nodes.find(item => item.key === node.id)!.label })) };
      return { ok: true, intent: 'replace-sendero-draft' };
    });
    const router = createMemoryRouter([{ path: '*', loader: () => ({ graph: current }), action, element: <Editor /> }]);
    const { container } = render(<RouterProvider router={router} />);
    await screen.findByRole('button', { name: 'Cancel changes' });
    const label = () => screen.getAllByLabelText('Node label')[1] as HTMLInputElement;
    fireEvent.change(label(), { target: { value: 'Local unsaved' } });
    current = { ...current, revision: 'other-tab', nodes: current.nodes.map(node => node.id === 'node-agent' ? { ...node, label: 'Other tab' } : node) };
    await act(async () => { await router.revalidate(); });
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('changed elsewhere'));
    expect(label().value).toBe('Local unsaved');
    expect(container.querySelector<HTMLInputElement>('input[name="expectedRevision"]')!.value).toBe('initial');
    fireEvent.click(screen.getByRole('button', { name: 'Save graph draft' }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    await screen.findByRole('button', { name: 'Save graph draft' });
    expect(label().value).toBe('Local unsaved');
    expect(container.querySelector<HTMLInputElement>('input[name="expectedRevision"]')!.value).toBe('initial');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel changes' }));
    expect(label().value).toBe('Other tab');
    expect(container.querySelector<HTMLInputElement>('input[name="expectedRevision"]')!.value).toBe('other-tab');
    expect(action).toHaveBeenCalledTimes(1);
    for (const name of ['Saved once', 'Saved twice']) {
      fireEvent.change(label(), { target: { value: name } });
      fireEvent.click(screen.getByRole('button', { name: 'Save graph draft' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Save graph draft' })).toHaveProperty('disabled', true));
      expect(label().value).toBe(name);
    }
    expect(action).toHaveBeenCalledTimes(3);
  });
});
