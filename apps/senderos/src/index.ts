export type ObjectiveStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "validating"
  | "done"
  | "blocked";

export interface Objective {
  id: string;
  title: string;
  summary: string;
  status: ObjectiveStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationSummary {
  checksTotal: number;
  checksPassed: number;
  confidence: "low" | "medium" | "high";
}

export function createObjective(input: Pick<Objective, "id" | "title" | "summary">): Objective {
  const now = new Date().toISOString();

  return {
    ...input,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

export function summarizeValidation(checksPassed: number, checksTotal: number): ValidationSummary {
  const ratio = checksTotal === 0 ? 0 : checksPassed / checksTotal;

  return {
    checksPassed,
    checksTotal,
    confidence: ratio >= 0.9 ? "high" : ratio >= 0.6 ? "medium" : "low",
  };
}

if (import.meta.main) {
  const objective = createObjective({
    id: "objective_bootstrap",
    title: "Bootstrap Senderos",
    summary: "Establish the first local monorepo foundation for Senderos.",
  });

  console.log(JSON.stringify(objective, null, 2));
}
