import type { FeatureRecord, LoopPhase } from "../../domain/types";
export function defaultInstruction(feature: FeatureRecord, phase: LoopPhase, workspaceRoot?: string) {
  const base = { featureId: feature.id, featureTitle: feature.title, phase, workspaceRoot, constraints: ["Operate only inside the assigned Senderos workspace", "Do not mutate Senderos state directly; report results back through Senderos", "Return machine-readable execution results"] };
  if (phase === "contract") return { ...base, objective: "Refine the executable feature contract and acceptance criteria." };
  if (phase === "implementation") return { ...base, objective: "Implement the feature through the TDD loop inside the assigned workspace." };
  if (phase === "review") return { ...base, objective: "Review the implementation, prune issues, and confirm readiness for mutation testing." };
  if (phase === "mutation") return { ...base, objective: "Run the mutation-confidence gate and report survivors or a clean pass." };
  return { ...base, objective: "No further work required." };
}
