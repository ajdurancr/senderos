import type { FeatureStatus, RunPhase } from './types';

export const LOOP_SEQUENCE: RunPhase[] = ['implementation', 'review', 'mutation'];

export function nextPhase(current: RunPhase): RunPhase {
  if (current === 'idle') return 'implementation';
  const index = LOOP_SEQUENCE.indexOf(current);
  if (index === -1 || index === LOOP_SEQUENCE.length - 1) return 'done';
  return LOOP_SEQUENCE[index + 1];
}

export function statusForPhase(phase: RunPhase): FeatureStatus {
  if (phase === 'done') return 'completed';
  if (phase === 'blocked') return 'blocked';
  return 'active';
}
