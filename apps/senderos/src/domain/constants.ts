import type { LoopPhase, FeatureStatus } from "./types";

export const LOOP_SEQUENCE: LoopPhase[] = ["contract", "implementation", "review", "mutation"];

export function nextPhase(current: LoopPhase): LoopPhase {
  if (current === "idle") return "contract";
  const index = LOOP_SEQUENCE.indexOf(current);
  if (index === -1 || index === LOOP_SEQUENCE.length - 1) return "done";
  return LOOP_SEQUENCE[index + 1];
}

export function statusForPhase(phase: LoopPhase): FeatureStatus {
  if (phase === "contract") return "ready";
  if (phase === "implementation") return "active";
  if (phase === "review" || phase === "mutation") return "verifying";
  if (phase === "done") return "completed";
  return "failed";
}
