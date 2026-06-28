import { defaultHomePath, resolveRuntime } from '../../../config/runtime';

export function schedulePlan(home?: string) {
  const { config } = resolveRuntime(home);

  return {
    jobName: 'senderos-loop-maintenance',
    command: 'senderos reconcile && senderos status && senderos loop tick <feature-id>',
    cadence: '*/15 * * * *',
    env: {
      SENDEROS_HOME: defaultHomePath(),
      SENDEROS_OUTPUT: config.output.format,
    },
    guardrails: [
      'Run only in the configured Senderos home',
      'Do not bypass workspace locks or reconciliation',
      'Treat Senderos JSON output as the source of truth',
    ],
    expectedOutputs: [
      'Reconciliation summary',
      'Current system status',
      'Optional loop advancement result',
    ],
    recovery: [
      'Run senderos reconcile',
      'Inspect senderos status',
      'Resume with senderos loop resume <feature-id>',
    ],
    hostAgentContract: {
      harness: config.defaultHarness,
      outputMode: 'json',
      hostResponsibleForScheduling: true,
    },
  };
}
