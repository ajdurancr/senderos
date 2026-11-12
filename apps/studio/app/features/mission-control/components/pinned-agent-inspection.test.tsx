import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';
import { SenderoInspector } from './sendero-inspector';
import { OrchestrationCanvas } from './orchestration-canvas';
import { ContextualInspector } from './contextual-inspector';
afterEach(cleanup);
function dataWith(snapshot: string | null, status: 'draft' | 'published' = 'published') {
  const graph = fixture.senderoGraphs[0]!;
  const updated = { ...graph, version: { ...graph.version, status }, nodes: graph.nodes.map(node => node.kind === 'agent' ? { ...node, agentSnapshotJson: snapshot } : node) };
  return { ...fixture, agents: fixture.agents.map(agent => ({ ...agent, name: 'Later live name', definitionBody: 'Later live instructions' })), senderoGraphs: [updated], historyGraphs: [updated] };
}
const pinned = JSON.stringify({ id: 'agent-1', name: 'Original pinned name', instructions: 'Original pinned instructions', requiredCapabilities: [] });
for (const surface of ['workflow', 'goal'] as const) {
  function view(snapshot: string | null, status: 'draft' | 'published' = 'published') {
    const data = dataWith(snapshot, status);
    return render(<RouterProvider router={createMemoryRouter([{ path: '*', element: surface === 'workflow'
      ? <SenderoInspector data={data} senderoId="sendero-1" nodeId="node-agent" />
      : <ContextualInspector data={data} goalId="goal-1" nodeId="node-agent" /> }])} />);
  }
  test(`${surface} identifies the published agent and its instructions independently of later edits`, () => {
    const result = view(pinned);
    expect(result.container.textContent).toContain('Original pinned name');
    expect(screen.getByText('Pinned instructions', { selector: 'summary' })).toBeTruthy();
    expect(result.container.textContent).toContain('Original pinned instructions');
    expect(result.container.textContent).not.toContain('Later live instructions');
    expect(result.container.textContent).toContain('Current agent');
    expect(result.container.textContent).toContain('Later live name');
  });
  for (const snapshot of [null, '{bad', '{}', '[]', JSON.stringify({ id: 'another-agent', name: 'Wrong agent', instructions: 'Wrong policy' })]) {
    test(`${surface} reports unavailable pinning for ${snapshot}`, () => {
      const result = view(snapshot);
      expect(result.container.textContent).toContain('Pinned agent snapshot unavailable');
      expect(result.container.textContent).toContain('Later live name');
      expect(result.container.textContent).not.toContain('Wrong policy');
      expect(screen.queryByText('Pinned instructions', { selector: 'summary' })).toBeNull();
    });
  }
  test(`${surface} does not label a draft snapshot as published`, () => {
    const result = view(pinned, 'draft');
    expect(result.container.textContent).toContain('Later live name');
    expect(result.container.textContent).not.toContain('Original pinned instructions');
    expect(screen.getByText('Current instructions', { selector: 'summary' })).toBeTruthy();
  });
}

test('goal inspection uses its historical version and retains pinned facts when the live definition is absent', () => {
  const data = dataWith(pinned);
  data.senderoGraphs = dataWith(JSON.stringify({ id: 'agent-1', name: 'Later publication', instructions: 'Later policy' })).senderoGraphs;
  data.agents = [];
  const result = render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <ContextualInspector data={data} goalId="goal-1" nodeId="node-agent" /> }])} />);
  expect(result.container.textContent).toContain('Original pinned name');
  expect(result.container.textContent).toContain('Original pinned instructions');
  expect(result.container.textContent).not.toContain('Later publication');
  expect(result.container.textContent).toContain('Unavailable');
});

for (const goal of [false, true]) test(`canvas shows the pinned identity (${goal ? 'goal' : 'workflow'})`, () => {
  const result = render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <OrchestrationCanvas data={dataWith(pinned)} {...(goal ? { goalId: 'goal-1' } : { senderoId: 'sendero-1' })} /> }])} />);
  const link = screen.getByRole('link', { name: 'Inspect agent Agent' });
  expect(link.textContent).toContain('Original pinned name');
  expect(link.title).toContain('Pinned agent: Original pinned name');
  expect(link.textContent).not.toContain('Later live name');
  expect(result.container.textContent).not.toContain('Original pinned instructions');
});
