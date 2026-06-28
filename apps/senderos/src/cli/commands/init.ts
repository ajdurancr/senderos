import type { HarnessKind } from '../../domain/types';
import { initializeRuntime, previewInit } from '../../config/runtime';

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
