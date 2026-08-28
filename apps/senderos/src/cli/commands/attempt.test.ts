import { expect, test } from 'bun:test';
import { handleAttempt } from './attempt';
import { createRunAttempt, getAgentBySlug } from '../../services/runtime';
import { initHome } from '../../../tests/helpers/runtime';

test('attempt command lists, shows, and resumes attempts', () => {
  const home = initHome();
  const agent = getAgentBySlug('spec-partner', home)!;
  const attempt = createRunAttempt({
    home,
    runId: 'run-1',
    attemptNumber: 1,
    agentId: agent.id,
    executionObjective: 'Execute work.',
    harness: 'codex',
    resumeCommand: 'codex resume abc',
  });
  expect(
    (handleAttempt as any)('list', [], { 'run-id': 'run-1' }, home),
  ).toHaveLength(1);
  expect(
    (handleAttempt as any)('show', ['attempt', 'show', attempt.id], {}, home)
      .id,
  ).toBe(attempt.id);
  expect(
    (handleAttempt as any)(
      'resume',
      ['attempt', 'resume', attempt.id],
      {},
      home,
    ).resumeCommand,
  ).toContain('resume');
});
