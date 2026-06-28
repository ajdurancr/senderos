import type { FeatureStatus, LoopPhase } from './types';

export const LOOP_SEQUENCE: LoopPhase[] = ['implementation', 'review', 'mutation'];

export function nextPhase(current: LoopPhase): LoopPhase {
  if (current === 'idle') return 'implementation';
  const index = LOOP_SEQUENCE.indexOf(current);
  if (index === -1 || index === LOOP_SEQUENCE.length - 1) return 'done';
  return LOOP_SEQUENCE[index + 1];
}

export function statusForPhase(phase: LoopPhase): FeatureStatus {
  if (phase === 'done') return 'completed';
  if (phase === 'blocked') return 'blocked';
  return 'active';
}
