import type { FeatureStatus, SenderoStep } from './types';

export const SENDERO_STEP_SEQUENCE: SenderoStep[] = ['implementation', 'review', 'mutation'];

export function nextPhase(current: SenderoStep): SenderoStep {
  if (current === 'idle') return 'implementation';
  const index = SENDERO_STEP_SEQUENCE.indexOf(current);
  if (index === -1 || index === SENDERO_STEP_SEQUENCE.length - 1) return 'done';
  return SENDERO_STEP_SEQUENCE[index + 1];
}

export function statusForPhase(phase: SenderoStep): FeatureStatus {
  if (phase === 'done') return 'completed';
  if (phase === 'blocked') return 'blocked';
  return 'active';
}
