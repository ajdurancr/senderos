import { describe, expect, test } from 'bun:test';
import { SENDERO_STEP_SEQUENCE, nextPhase, statusForPhase } from './constants';

describe('domain constants', () => {
  test('maps sendero supervisor progression and statuses', () => {
    expect(SENDERO_STEP_SEQUENCE).toEqual(['implementation', 'review', 'mutation']);
    expect(nextPhase('idle')).toBe('implementation');
    expect(nextPhase('mutation')).toBe('done');
    expect(statusForPhase('review')).toBe('active');
    expect(statusForPhase('blocked')).toBe('blocked');
  });
});
