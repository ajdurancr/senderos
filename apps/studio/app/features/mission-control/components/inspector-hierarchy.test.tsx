import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { ContextualInspector } from './contextual-inspector';
import { SenderoInspector } from './sendero-inspector';
import { HostExecutionRecords } from './execution-records';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';

afterEach(cleanup);
function inRouter(element: React.ReactNode) {
  return render(<RouterProvider router={createMemoryRouter([{ path: '*', element, action: () => null }])} />);
}

describe('inspector hierarchy', () => {
  it('keeps evidence ahead of collapsed technical and host records', () => {
    const { container } = inRouter(<ContextualInspector data={fixture} goalId={fixture.goals[0]!.id} />);
    const evidence = screen.getByRole('heading', { name: 'Evidence & review' });
    for (const title of ['Technical details', 'Host and session records']) {
      const summary = screen.getByText(title, { selector: 'summary' });
      const details = summary.closest('details')!;
      expect(details.open).toBe(false);
      expect(evidence.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      fireEvent.click(summary);
      expect(details.open).toBe(true);
      fireEvent.click(summary);
      expect(details.open).toBe(false);
    }
    expect(container.querySelector('.inspector-tabs')).toBeNull();
    for (const label of ['Role', 'Checkpoint', 'Heartbeat']) {
      expect(screen.getAllByText(label, { selector: 'dt' })[0]!.closest('details')?.querySelector('summary')?.textContent).toBe('Technical details');
    }
    expect(screen.getByRole('link', { name: 'Back to project' }).getAttribute('href')).toBe('/projects/project-1/canvas');
    expect(screen.getAllByText('/tmp/work').length).toBeGreaterThan(0);
  });

  it('keeps lease-expiry warnings visible when records are collapsed', () => {
    render(<HostExecutionRecords data={fixture} attempt={{ ...fixture.attempts[0]!, status: 'running', leaseExpiresAt: '2000-01-01T00:00:00.000Z' }} />);
    expect(screen.getByRole('status').closest('details')).toBeNull();
    expect(screen.getByText('Host and session records', { selector: 'summary' }).closest('details')!.open).toBe(false);
  });

  it('labels evidence and review controls without relying on placeholders', () => {
    const data = { ...fixture, attempts: [{ ...fixture.attempts[0]!, status: 'running' as const }] };
    inRouter(<ContextualInspector data={data} goalId={fixture.goals[0]!.id} />);
    expect(screen.getByRole('textbox', { name: 'Evidence label' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Evidence URL (optional)' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Review decision' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Decision rationale' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Request stop' }).classList.contains('button-danger')).toBe(true);
  });

  it('separates publishing from metadata and preserves draft editing labels', () => {
    const graph = fixture.senderoGraphs[0]!;
    const data = { ...fixture, senderoGraphs: [{ ...graph, version: { ...graph.version, status: 'draft' as const } }] };
    inRouter(<SenderoInspector data={data} senderoId={graph.sendero.id} edgeId={graph.edges[0]!.id} />);
    const publish = screen.getByRole('button', { name: 'Validate & publish draft' });
    expect(publish.closest('dl')).toBeNull();
    expect(publish.classList.contains('button-primary')).toBe(true);
    expect(screen.getByText('Technical details').closest('details')!.open).toBe(false);
    expect(screen.getByRole('textbox', { name: 'Arc name' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Transition status' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save arc' })).toBeTruthy();
  });
});
