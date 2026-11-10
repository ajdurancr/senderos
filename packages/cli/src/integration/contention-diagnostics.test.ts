import { expect, test } from 'bun:test';
import { contentionOutcomes } from '../../../../examples/external-host/contention';

test('contention diagnostics retain exit status and known failure codes without reply secrets', () => {
  const outcomes = contentionOutcomes([
    { exitCode: 0, value: { token: 'private-claim-token', packet: { path: '/private/host' } }, stderr: 'private stderr' },
    { exitCode: 75, value: { code: 'DATABASE_BUSY', retryable: true, error: 'SQL with private parameters' }, stderr: 'private stderr' },
    { exitCode: 1, value: { code: 'ALREADY_CLAIMED', retryable: false }, stderr: '' },
    { exitCode: 1, value: { code: 'private-claim-token', retryable: 'private value' }, stderr: '' },
    { exitCode: 1, value: null, stderr: 'private stderr' },
  ]);
  expect(outcomes).toEqual([
    { contender: 0, exitCode: 0, code: 'SUCCESS', retryable: false },
    { contender: 1, exitCode: 75, code: 'DATABASE_BUSY', retryable: true },
    { contender: 2, exitCode: 1, code: 'ALREADY_CLAIMED', retryable: false },
    { contender: 3, exitCode: 1, code: 'UNRECOGNIZED_ERROR', retryable: false },
    { contender: 4, exitCode: 1, code: 'UNRECOGNIZED_ERROR', retryable: false },
  ]);
  expect(JSON.stringify(outcomes)).not.toContain('private');
});
