import { Database } from 'bun:sqlite';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const tempRoot = join(process.cwd(), '.tmp');
const integrationArtifactsRoot = join(tempRoot, 'integration-tests');
const integrationRunRoot = join(
  integrationArtifactsRoot,
  `run-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
);
const tempPaths: string[] = [];

function ensureIntegrationRunRoot() {
  mkdirSync(integrationRunRoot, { recursive: true });
  return integrationRunRoot;
}

export function tempDir(prefix: string) {
  const path = mkdtempSync(join(ensureIntegrationRunRoot(), `${prefix}-`));
  tempPaths.push(path);
  return path;
}

export function createTempProject(options?: {
  dirPrefix?: string;
  packageName?: string;
  extraFiles?: Array<{ path: string; content: string }>;
}) {
  const root = tempDir(options?.dirPrefix ?? 'senderos-int-project');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: options?.packageName ?? 'senderos-smoke',
        private: true,
        scripts: {
          build: 'echo build',
          test: 'echo test',
          lint: 'echo lint',
        },
      },
      null,
      2,
    ),
  );
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'index.ts'), 'export const smoke = true;\n');

  for (const extra of options?.extraFiles ?? []) {
    const fullPath = join(root, extra.path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, extra.content);
  }

  return root;
}

export function cli(args: string[], cwd = process.cwd()) {
  const result = Bun.spawnSync({
    cmd: ['bun', 'src/index.ts', ...args],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  });

  const stdout = result.stdout.toString().trim();
  const stderr = result.stderr.toString().trim();

  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed: bun src/index.ts ${args.join(' ')}\nstdout: ${stdout}\nstderr: ${stderr}`,
    );
  }

  return stdout ? JSON.parse(stdout) : null;
}

export function openDb(home: string) {
  return new Database(join(home, 'senderos.db'));
}

export function pathExists(path: string) {
  return existsSync(path);
}

export function cleanupIntegrationTemps() {
  while (tempPaths.length) {
    rmSync(tempPaths.pop()!, { recursive: true, force: true });
  }
}

export function cleanupIntegrationRunRoot() {
  rmSync(integrationRunRoot, { recursive: true, force: true });

  try {
    if (
      existsSync(integrationArtifactsRoot) &&
      readdirSync(integrationArtifactsRoot).length === 0
    ) {
      rmSync(integrationArtifactsRoot, { recursive: true, force: true });
    }
    if (existsSync(tempRoot) && readdirSync(tempRoot).length === 0) {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  } catch {
    // best-effort cleanup only
  }
}
