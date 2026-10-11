import {
  getAttempt,
  listRunAttempts,
  resumeAttempt,
  updateRunAttempt,
  claimAttempt,
  abandonAttempt,
  heartbeatAttempt,
  startAttempt,
  reconcileAttempt,
  hostPreflight,
  recordAttemptEvidence,
  reviewRunAttempt,
} from '@senderos/core';
import { resolveExecutionContextId } from '@senderos/core';
import { enumOption, optionString, requirePositional } from '../shared';
import type { RunAttemptStatus } from '@senderos/core';
const attemptStatuses = ['queued', 'running', 'paused', 'succeeded', 'failed', 'canceled'] as const satisfies readonly RunAttemptStatus[];
export const attemptCommandHelp = {
  command: 'attempt',
  summary: 'Inspect concrete run attempts.',
  usage: ['senderos attempt <list|show|preflight|claim|start|reconcile|heartbeat|update|evidence|review|resume|abandon> ...'],
  subcommands: [
    { command: 'preflight', summary: 'Check declared host capabilities and workspace access.', usage: ['senderos attempt preflight <id> --owner-id <host>'] },
    { command: 'start', summary: 'Record the independent worker session after claiming.', usage: ['senderos attempt start <id> --token <token> --external-session-id <worker> --parent-session-id <parent> --working-path <path> [--resume-command <command>]'] },
    { command: 'reconcile', summary: 'Persist a host inspection of an existing external session.', usage: ['senderos attempt reconcile <id> --owner-id <host> --outcome active|finished|missing|unknown --details <inspection> [--token <token>] [--external-session-id <id>] [--status succeeded|failed|canceled] [--result-json <json>]'] },
    { command: 'abandon', summary: 'Recover an attempt after independently confirming its external process stopped.', usage: ['senderos attempt abandon <id> --confirmed-stopped --reason <text>'] },
    { command: 'claim', summary: 'Claim queued work or explicitly reclaim an expired lease.', usage: ['senderos attempt claim <id> --owner-id <host> [--reclaim] [--token <current-token>] [--lease-seconds 120]'] },
    { command: 'heartbeat', summary: 'Renew ownership and check cancellation requests.', usage: ['senderos attempt heartbeat <id> --token <token> [--lease-seconds 120]'] },
    { command: 'evidence', summary: 'Record completion evidence.', usage: ['senderos attempt evidence <id> --kind test --label <label> [--url <url>] [--token <claim-token>]'] },
    { command: 'review', summary: 'Record a review decision.', usage: ['senderos attempt review <id> --status approved --reviewer <name> [--rationale <text>]'] },
    {
      command: 'list',
      summary: 'List run attempts.',
      usage: ['senderos attempt list [--run-id <run-id>]'],
    },
    {
      command: 'show',
      summary: 'Show a run attempt.',
      usage: ['senderos attempt show <attempt-id>'],
    },
    {
      command: 'update',
      summary: 'Record attempt state and outcome.',
      usage: ['senderos attempt update <attempt-id> --token <claim-token> --status <status> [--result-json <json>]'],
    },
    {
      command: 'resume',
      summary: 'Show attempt resume information.',
      usage: ['senderos attempt resume <attempt-id>'],
    },
  ],
};
export async function handleAttempt(
  subcommand: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean | string[]>,
  home: string,
) {
  const executionContextId = resolveExecutionContextId(home);
  const requireOwnedAttempt = async () => {
    const id = requirePositional(positionals[2], 'attempt id');
    if (!(await getAttempt(id, home, executionContextId)))
      throw new Error(`Attempt not found in the current execution context: ${id}`);
    return id;
  };
  const attemptId = () => requirePositional(positionals[2], 'attempt id');
  switch (subcommand) {
    case 'preflight': return hostPreflight({ attemptId: attemptId(), ownerId: requirePositional(optionString(options['owner-id']), 'owner id') }, home);
    case 'start': return startAttempt({ attemptId: attemptId(), token: requirePositional(optionString(options.token), 'token'), externalSessionId: requirePositional(optionString(options['external-session-id']), 'external session id'), parentSessionId: requirePositional(optionString(options['parent-session-id']), 'parent session id'), workingPath: requirePositional(optionString(options['working-path']), 'working path'), resumeCommand: optionString(options['resume-command']) }, home);
    case 'reconcile': return reconcileAttempt({ attemptId: attemptId(), ownerId: requirePositional(optionString(options['owner-id']), 'owner id'), outcome: enumOption(optionString(options.outcome), ['active','finished','missing','unknown'] as const, 'outcome')!, details: requirePositional(optionString(options.details), 'inspection details'), token: optionString(options.token), externalSessionId: optionString(options['external-session-id']), status: enumOption(optionString(options.status), ['succeeded','failed','canceled'] as const, 'status'), result: options['result-json'] ? JSON.parse(String(options['result-json'])) : undefined }, home);
    case 'abandon': return abandonAttempt({ attemptId: attemptId(), token: optionString(options.token), confirmedStopped: options['confirmed-stopped'] === true, reason: requirePositional(optionString(options.reason), 'reason') }, home);
    case 'claim':
      return claimAttempt({ attemptId: attemptId(), ownerId: requirePositional(optionString(options['owner-id']), 'owner id'), reclaim: options.reclaim === true, token: optionString(options.token), leaseSeconds: options['lease-seconds'] === undefined ? undefined : Number(options['lease-seconds']) }, home);
    case 'heartbeat':
      return heartbeatAttempt({ attemptId: attemptId(), token: requirePositional(optionString(options.token), 'token'), leaseSeconds: options['lease-seconds'] === undefined ? undefined : Number(options['lease-seconds']) }, home);
    case 'evidence':
      return recordAttemptEvidence({ home, attemptId: await requireOwnedAttempt(), token: optionString(options.token), kind: enumOption(optionString(options.kind), ['test', 'ci', 'pull_request', 'artifact', 'manual'] as const, 'kind') ?? 'manual', label: requirePositional(optionString(options.label), 'label'), url: optionString(options.url) });
    case 'review':
      return reviewRunAttempt({ home, attemptId: await requireOwnedAttempt(), status: enumOption(optionString(options.status), ['pending', 'approved', 'changes_requested', 'rejected'] as const, 'status') ?? 'pending', reviewer: requirePositional(optionString(options.reviewer), 'reviewer'), rationale: optionString(options.rationale) });
    case 'list':
      return await listRunAttempts(optionString(options['run-id']), home, executionContextId);
    case 'show':
      return await getAttempt(requirePositional(positionals[2], 'attempt id'), home, executionContextId);
    case 'update':
      return await updateRunAttempt(
        attemptId(),
        {
          token: optionString(options.token),
          status: enumOption(optionString(options.status), attemptStatuses, 'status'),
          checkpoint: optionString(options.checkpoint),
          workingPath: optionString(options['working-path']),
          externalSessionId: optionString(options['external-session-id']),
          resumeCommand: optionString(options['resume-command']),
          failureStep: optionString(options['failure-step']),
          failureSummary: optionString(options['failure-summary']),
          result: options['result-json']
            ? JSON.parse(String(options['result-json']))
            : undefined,
        },
        home,
      );
    case 'resume':
      return await resumeAttempt(
        await requireOwnedAttempt(),
        home,
      );
    default:
      throw new Error('Unknown attempt action');
  }
}
