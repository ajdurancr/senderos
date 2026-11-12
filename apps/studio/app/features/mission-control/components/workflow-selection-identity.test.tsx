import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';
import { GoalCreation } from './goal-creation';
import { GoalPreparation } from './goal-preparation';
import { SenderoSelector } from './sendero-selector';

afterEach(cleanup);
const graphs = ['first-policy', 'second-policy'].map((slug, index) => ({
  ...fixture.senderoGraphs[0]!,
  sendero: { ...fixture.senderoGraphs[0]!.sendero, id: `workflow-${index}`, slug, name: 'Shared outcome' },
  version: { ...fixture.senderoGraphs[0]!.version, id: `version-${index}`, senderoId: `workflow-${index}`, status: 'published' as const, version: 1 },
}));
for (const surface of ['creation', 'preparation', 'inspector'] as const) {
  it(`distinguishes same-name workflows in ${surface} while preserving exact selected identity`, async () => {
    const action = vi.fn(async ({ request }: { request: Request }) => ({ ok: false, intent: (await request.formData()).get('intent') }));
    const element = surface === 'creation' ? <GoalCreation projectId="project-1" graphs={graphs} />
      : surface === 'preparation' ? <GoalPreparation goal={{ ...fixture.goals[0]!, status: 'draft', senderoVersionId: graphs[0]!.version.id }} graphs={graphs} onEditingChange={() => {}} />
      : <SenderoSelector data={{ ...fixture, senderoGraphs: graphs }} senderoId={graphs[0]!.sendero.id} />;
    const router = createMemoryRouter([{ path: '*', action, element }], { initialEntries: ['/senderos/workflow-0?context=product&project=project-1'] });
    render(<RouterProvider router={router} />);
    if (surface === 'preparation') {
      await waitFor(() => expect(screen.getByRole('button', { name: 'Edit goal' })).toHaveProperty('disabled', false));
      fireEvent.click(screen.getByRole('button', { name: 'Edit goal' }));
    }
    const select = screen.getByRole('combobox', { name: surface === 'preparation' ? 'Goal workflow' : 'Sendero' });
    await waitFor(() => expect(select).toHaveProperty('disabled', false));
    for (const graph of graphs) expect(screen.getByRole('option', { name: `Shared outcome · ${graph.sendero.slug} · v1` })).toHaveProperty('value', surface === 'inspector' ? graph.sendero.id : graph.version.id);
    fireEvent.change(select, { target: { value: surface === 'inspector' ? graphs[1]!.sendero.id : graphs[1]!.version.id } });
    if (surface === 'inspector') {
      await waitFor(() => expect(router.state.location.pathname).toBe('/senderos/workflow-1'));
      expect(router.state.location.search).toBe('?context=product&project=project-1');
      expect(action).not.toHaveBeenCalled();
    } else expect(select).toHaveProperty('value', graphs[1]!.version.id);
  });
}
