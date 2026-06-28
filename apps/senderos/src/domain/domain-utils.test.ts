import { describe, expect, test } from 'bun:test';

import { LOOP_SEQUENCE, nextPhase, statusForPhase } from '../domain/constants';
import { now, randomId } from '../utils/common';
import { inferHarnessFromEnvironment } from '../utils/harness';

describe('domain and utility helpers', () => {
  test('infers harness from each supported environment family', () => {
    expect(
      inferHarnessFromEnvironment({ OPENCLAW_WORKSPACE_DIR: '/tmp/workspace' } as NodeJS.ProcessEnv)
    ).toBe('openclaw');
    expect(
      inferHarnessFromEnvironment({ CODEX_SESSION_ID: 'session-1' } as NodeJS.ProcessEnv)
    ).toBe('codex');
    expect(
      inferHarnessFromEnvironment({ CLAUDECODE_SESSION: 'session-2' } as NodeJS.ProcessEnv)
    ).toBe('claude-code');
    expect(inferHarnessFromEnvironment({} as NodeJS.ProcessEnv)).toBe('unknown');
  });

  test('creates timestamps and prefixed ids', () => {
    const timestamp = now();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
    expect(randomId('feature')).toMatch(/^feature-[a-z0-9]{8}$/);
  });

  test('maps loop phases and statuses', () => {
    expect(LOOP_SEQUENCE).toEqual(['contract', 'implementation', 'review', 'mutation']);
    expect(nextPhase('idle')).toBe('contract');
    expect(nextPhase('contract')).toBe('implementation');
    expect(nextPhase('review')).toBe('mutation');
    expect(nextPhase('mutation')).toBe('done');
    expect(nextPhase('blocked')).toBe('done');

    expect(statusForPhase('contract')).toBe('ready_contract');
    expect(statusForPhase('implementation')).toBe('active_implementation');
    expect(statusForPhase('review')).toBe('verifying_review');
    expect(statusForPhase('mutation')).toBe('verifying_mutation');
    expect(statusForPhase('done')).toBe('completed');
    expect(statusForPhase('blocked')).toBe('failed');
  });
});
