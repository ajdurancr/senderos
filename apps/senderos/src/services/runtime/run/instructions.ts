import type { FeatureRecord, SenderoStep } from '../../../domain/types';

export function defaultInstruction(
  feature: FeatureRecord,
  phase: SenderoStep,
  workspaceRoot?: string
) {
  const base = {
    featureId: feature.id,
    projectId: feature.projectId,
    featureTitle: feature.title,
    phase,
    workspaceRoot,
    baseTargetBranch: feature.baseTargetBranch,
    featureBranchName: feature.featureBranchName,
    gherkinText: feature.gherkinText,
    constraints: [
      'Operate only inside the assigned Senderos workspace',
      'Do not mutate Senderos state directly; report results back through Senderos',
      'Treat the stored Gherkin contract as canonical execution input',
      'Return machine-readable execution results',
    ],
  };

  if (phase === 'implementation') {
    return {
      ...base,
      objective: 'Implement the approved Gherkin contract through the TDD cycle inside the assigned workspace.',
    };
  }

  if (phase === 'review') {
    return {
      ...base,
      objective: 'Review the implementation, prune issues, and confirm readiness for mutation testing.',
    };
  }

  if (phase === 'mutation') {
    return {
      ...base,
      objective: 'Run the mutation-confidence gate and report survivors or a clean pass.',
    };
  }

  return {
    ...base,
    objective: 'No further work required.',
  };
}
