import type { HarnessKind } from '../../domain/types';
import { initializeRuntime, previewInit } from '../../config/runtime';

export const initCommandHelp = {
  command: 'init',
  summary: 'Preview or create the Senderos runtime.',
  usage: [
    'senderos init',
    'senderos init --home /path/to/.senderos --harness codex',
    'senderos init --home /path/to/.senderos --harness codex --approve',
  ],
  options: [
    { name: '--home', description: 'Proposed Senderos home directory.' },
    { name: '--harness', description: 'Harness to use: openclaw|codex|claude-code.' },
    { name: '--approve', description: 'Approve the previewed configuration and create files.' },
  ],
};

export async function handleInit(options: Record<string, string | boolean>) {
  const preview = previewInit(
    options.home as string | undefined,
    options.harness as HarnessKind | undefined
  );

  if (!options.approve) {
    return preview;
  }

  if (!options.harness && preview.inferredHarness === 'unknown') {
    throw new Error(
      'Harness is not known. Re-run with --harness <openclaw|codex|claude-code> and --approve.'
    );
  }

  return initializeRuntime(preview.home, preview.config);
}
