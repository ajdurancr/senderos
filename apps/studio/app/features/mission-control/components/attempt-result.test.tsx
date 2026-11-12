import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, test } from 'vitest';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';
import { RunsView } from './workspace-views';
import { ContextualInspector } from './contextual-inspector';
afterEach(cleanup);
function show(resultJson: string, surface: 'runs' | 'execution' = 'runs') {
  const data = { ...fixture, attempts: [{ ...fixture.attempts[0]!, resultJson }] };
  return render(<RouterProvider router={createMemoryRouter([{ path: '*', element: surface === 'runs'
    ? <RunsView data={data} attemptId="attempt-1" /> : <ContextualInspector data={data} goalId="goal-1" attemptId="attempt-1" /> }])} />);
}
for (const surface of ['runs', 'execution'] as const) {
  test(`${surface} exposes the selected host result without equating outcome with durable status`, () => {
    const result = { outcome: 'accepted', summary: 'Host finished the reviewed work.', details: { checks: ['a', 'b'], count: 2 } };
    show(JSON.stringify(result), surface);
    const region = screen.getByRole('region', { name: 'Recorded result' });
    expect(region.textContent).toContain(result.summary);
    expect(region.textContent).toContain('accepted');
    expect(region.textContent).toContain('Host-reported');
    expect(JSON.parse(region.querySelector('pre')!.textContent!)).toEqual(result);
    expect(screen.getAllByText('failed', { exact: true }).length).toBeGreaterThan(0);
  });
}
test('default empty result is explicit instead of inventing success from the attempt state', () => {
  show('{}');
  expect(screen.getByRole('region', { name: 'Recorded result' }).textContent).toContain('No result recorded for this attempt.');
});
test('a structured result without conventional summary fields remains inspectable', () => {
  const result = { reports: [{ value: 0, accepted: false }], summary: { retained: true }, nullable: null };
  show(JSON.stringify(result));
  const region = screen.getByRole('region', { name: 'Recorded result' });
  expect(JSON.parse(region.querySelector('pre')!.textContent!)).toEqual(result);
  expect(region.textContent).not.toContain('[object Object]');
});
test('malformed retained results preserve their text and report unreadable structure', () => {
  show('{"summary": unfinished');
  const region = screen.getByRole('region', { name: 'Recorded result' });
  expect(region.textContent).toContain('could not be read');
  expect(region.querySelector('pre')!.textContent).toBe('{"summary": unfinished');
});
test('recorded HTML and unsafe URLs are inert text, not markup or navigation', () => {
  show(JSON.stringify({ summary: '<img src=x onerror=alert(1)>', outcome: 'javascript:alert(1)', url: 'file:///private/fixture' }));
  const region = screen.getByRole('region', { name: 'Recorded result' });
  expect(region.textContent).toContain('<img');
  expect(region.querySelector('img,script,a')).toBeNull();
});
test('selecting an exact attempt never displays another attempt result', () => {
  const attempts = [{ ...fixture.attempts[0]!, resultJson: '{"summary":"Unselected result must stay hidden"}' }, { ...fixture.attempts[0]!, id: 'attempt-2', resultJson: '{"summary":"Only the selected result"}' }];
  render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <RunsView data={{ ...fixture, attempts }} attemptId="attempt-2" /> }])} />);
  expect(screen.getByRole('region', { name: 'Recorded result' }).textContent).toContain('Only the selected result');
  expect(screen.queryByText('Unselected result must stay hidden')).toBeNull();
});
