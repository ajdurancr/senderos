import { describe, expect, test } from 'bun:test';
import { LOOP_SEQUENCE, nextPhase, statusForPhase } from './constants';

describe('domain constants', () => {
  test('maps run progression and statuses', () => {
    expect(LOOP_SEQUENCE).toEqual(['implementation', 'review', 'mutation']);
    expect(nextPhase('idle')).toBe('implementation');
    expect(nextPhase('mutation')).toBe('done');
    expect(statusForPhase('review')).toBe('active');
    expect(statusForPhase('blocked')).toBe('blocked');
  });
});
