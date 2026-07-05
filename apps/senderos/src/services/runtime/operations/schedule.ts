import { defaultHomePath, resolveRuntime } from '../../../config/runtime';

export function schedulePlan(home?: string) {
  const { config } = resolveRuntime(home);

  return {
    jobName: 'senderos-supervision-maintenance',
    command: 'senderos reconcile && senderos status && senderos supervise-active',
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
      'Active supervision orchestration result',
    ],
    recovery: [
      'Run senderos reconcile',
      'Inspect senderos status',
      'Inspect run state with senderos run state <feature-id>',
      'Trigger orchestration with senderos supervise-active',
      'Resume progress with senderos run start --feature-id <feature-id>',
    ],
    hostAgentContract: {
      harness: config.defaultHarness,
      outputMode: 'json',
      hostResponsibleForScheduling: true,
    },
  };
}
