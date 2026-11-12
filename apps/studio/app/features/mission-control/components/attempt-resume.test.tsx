import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { HostExecutionRecords } from './execution-records';
import { missionControlFixture as fixture } from '../../../test-support/mission-control-fixture';

afterEach(cleanup);
const resumeCommand = 'synthetic-host resume --session example --note "<untrusted-host-text>"';
for (const status of ['running', 'succeeded', 'canceled'] as const) {
  test(`retains inert recorded resume guidance for a ${status} attempt without implying permission to run it`, () => {
    const { container } = render(<HostExecutionRecords data={fixture} attempt={{ ...fixture.attempts[0]!, status, resumeCommand }} />);
    expect(screen.getByText(resumeCommand).tagName).toBe('PRE');
    expect(screen.getByText(/Inspect the host, session, workspace and current ownership/)).toBeTruthy();
    expect(screen.getByText(/does not authorize resuming/)).toBeTruthy();
    expect(container.querySelector('untrusted-host-text')).toBeNull();
    expect(container.querySelector('a, button')).toBeNull();
  });
}
test('clearly identifies absent recorded resume guidance', () => {
  render(<HostExecutionRecords data={fixture} attempt={{ ...fixture.attempts[0]!, resumeCommand: null }} />);
  expect(screen.getByText('No resume command recorded.')).toBeTruthy();
});
