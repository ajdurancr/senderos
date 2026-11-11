import { execFileSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Transport complete isolated fixture results without changing their JSON shape. */
export function runJsonCommand(executable: string, args: string[], env: NodeJS.ProcessEnv): unknown {
  const directory = mkdtempSync(join(tmpdir(), 'senderos-e2e-output-'));
  const path = join(directory, 'result.json');
  let output: number | undefined;
  try {
    output = openSync(path, 'wx', 0o600);
    // A real descriptor avoids execFileSync's bounded stdout pipe. Large retained
    // snapshots must stay complete; child failures and the timeout still fail QA.
    execFileSync(executable, args, { env, stdio: ['ignore', output, 'pipe'], timeout: 20_000 });
    closeSync(output);
    output = undefined;
    return JSON.parse(readFileSync(path, 'utf8'));
  } finally {
    if (output !== undefined) closeSync(output);
    rmSync(directory, { recursive: true, force: true });
  }
}
