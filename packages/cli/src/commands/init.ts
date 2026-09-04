import type { HarnessKind } from '@senderos/core';
import { initializeRuntime, previewInit } from '@senderos/core';

export const initCommandHelp = {
  command: 'init',
  summary: 'Preview or create the Senderos runtime home.',
  agentDescription:
    'Use init to preview or create the Senderos home directory and database. This is a bootstrap/setup command and does not plan or dispatch any goal work.',
  usage: [
    'senderos init',
    'senderos init --home /path/to/.senderos --harness codex',
    'senderos init --home /path/to/.senderos --harness codex --approve',
  ],
  options: [
    { name: '--home', description: 'Proposed Senderos home directory.' },
    {
      name: '--harness',
      description: 'Harness to use: openclaw|codex|claude-code.',
    },
    {
      name: '--approve',
      description: 'Approve the previewed configuration and create files.',
    },
  ],
};

export async function handleInit(
  options: Record<string, string | boolean | string[]>,
) {
  const preview = previewInit(
    (Array.isArray(options.home) ? options.home.at(-1) : options.home) as
      | string
      | undefined,
    (Array.isArray(options.harness)
      ? options.harness.at(-1)
      : options.harness) as HarnessKind | undefined,
  );

  if (!options.approve) {
    return preview;
  }

  if (!options.harness && preview.inferredHarness === 'unknown') {
    throw new Error(
      'Harness is not known. Re-run with --harness <openclaw|codex|claude-code> and --approve.',
    );
  }

  return initializeRuntime(preview.home, preview.config);
}
