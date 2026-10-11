import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { successfulCli, type WorkerConfiguration } from './protocol';

/**
 * A deterministic, independent host session. It consumes one JSON configuration
 * followed by JSON commands on stdin; only public CLI calls change Senderos.
 * Its workspace is private to this simulated tool/machine. Results go over stdout.
 */
const lines = createInterface({ input: process.stdin });
let configuration: WorkerConfiguration | undefined;
let cliProcesses = 0;

function send(type: string, fields: Record<string, unknown> = {}) {
  process.stdout.write(`${JSON.stringify({ type, pid: process.pid, cliProcesses, ...fields })}\n`);
}

async function command(args: string[]) {
  const input = configuration!;
  cliProcesses++;
  return successfulCli(input.home, input.databaseUrl, args, input.workspace);
}

try {
  for await (const line of lines) {
    if (!line.trim()) continue;
    if (!configuration) {
      configuration = JSON.parse(line) as WorkerConfiguration;
      if (process.cwd() !== configuration.workspace) throw new Error('Worker cwd does not match its host-local workspace');
      const marker = readFileSync(join(configuration.workspace, 'host-local.txt'), 'utf8');
      if (marker !== configuration.expectedMarker) throw new Error('Host-local workspace verification failed');
      if (!configuration.skipStartReportForCrashSimulation) {
        await command([
          'attempt', 'start', configuration.attemptId,
          '--token', configuration.token,
          '--external-session-id', configuration.sessionId,
          '--parent-session-id', configuration.parentSessionId,
          '--working-path', configuration.workspace,
          '--resume-command', `external-host resume ${configuration.sessionId}`,
        ]);
      }
      send('started', {
        parentPid: process.ppid,
        sessionId: configuration.sessionId,
        parentSessionId: configuration.parentSessionId,
        workspace: process.cwd(),
        marker,
        hostId: configuration.hostId,
      });
      continue;
    }
    const input = JSON.parse(line) as { type: string; token?: string };
    switch (input.type) {
      case 'replace-token':
        if (!input.token) throw new Error('Replacement token is required');
        configuration.token = input.token;
        send('token-replaced');
        break;
      case 'heartbeat': {
        const heartbeat = await command(['attempt', 'heartbeat', configuration.attemptId, '--token', configuration.token]);
        send('heartbeat', { heartbeat });
        break;
      }
      case 'finish': {
        writeFileSync(join(configuration.workspace, `result-${configuration.attemptId}.json`), JSON.stringify(configuration.result));
        const attempt = await command([
          'attempt', 'update', configuration.attemptId, '--token', configuration.token,
          '--status', 'succeeded', '--result-json', JSON.stringify(configuration.result),
        ]);
        send('finished', { status: attempt.status, result: configuration.result });
        process.exit(0);
      }
      case 'fail': {
        const attempt = await command(['attempt', 'update', configuration.attemptId, '--token', configuration.token, '--status', 'failed', '--failure-summary', 'Deterministic worker failure before branch completion']);
        send('failed', { status: attempt.status });
        process.exit(0);
      }
      case 'finish-without-report':
        writeFileSync(join(configuration.workspace, `result-${configuration.attemptId}.json`), JSON.stringify(configuration.result));
        send('finished-unreported', { result: configuration.result });
        process.exit(0);
      case 'cancel': {
        const heartbeat = await command(['attempt', 'heartbeat', configuration.attemptId, '--token', configuration.token]);
        if (!heartbeat.cancellationRequested) throw new Error('Host may only acknowledge an actual cancellation request');
        const attempt = await command(['attempt', 'update', configuration.attemptId, '--token', configuration.token, '--status', 'canceled']);
        send('canceled', { status: attempt.status });
        process.exit(0);
      }
      case 'exit-without-report':
        send('exiting');
        process.exit(0);
      default:
        throw new Error(`Unknown worker control message: ${input.type}`);
    }
  }
} catch (error) {
  send('error', { message: (error as Error).message });
  process.exitCode = 1;
}
