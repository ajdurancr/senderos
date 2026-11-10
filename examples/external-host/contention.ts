import type { CliResponse } from './protocol';

// Never serialize raw replies: successful claims contain ownership tokens and
// failures may contain SQL parameters, command arguments, or host paths.
const diagnosticCodes = new Set([
  'DATABASE_BUSY', 'COMMAND_ERROR', 'ALREADY_CLAIMED', 'NOT_READY',
  'NOT_FOUND', 'STALE_PLAN', 'IDEMPOTENCY_CONFLICT', 'PREFLIGHT_FAILED',
  'CLAIM_REQUIRED', 'RECLAIM_REQUIRED', 'RECOVERY_REQUIRED',
]);
export function contentionOutcomes(responses: CliResponse<unknown>[]) {
  return responses.map(({ exitCode, value }, contender) => {
    const reply = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
      contender,
      exitCode,
      code: exitCode === 0 ? 'SUCCESS' : typeof reply.code === 'string' && diagnosticCodes.has(reply.code) ? reply.code : 'UNRECOGNIZED_ERROR',
      retryable: reply.retryable === true,
    };
  });
}
