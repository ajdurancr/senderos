import { describe, expect, test } from 'bun:test';
import { LOOP_SEQUENCE, nextPhase, statusForPhase } from './constants';

describe('domain constants', () => {
  test('maps loop progression and statuses', () => {
    expect(LOOP_SEQUENCE).toEqual(['contract','implementation','review','mutation']);
    expect(nextPhase('idle')).toBe('contract');
    expect(nextPhase('mutation')).toBe('done');
    expect(statusForPhase('review')).toBe('verifying_review');
    expect(statusForPhase('blocked')).toBe('failed');
  });
});
