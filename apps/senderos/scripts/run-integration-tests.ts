import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const integrationDir = join(packageRoot, 'src', 'integration');
const artifactsRoot = join(packageRoot, '.tmp', 'integration-tests');

function resetArtifactsRoot() {
  rmSync(artifactsRoot, { recursive: true, force: true });
  mkdirSync(artifactsRoot, { recursive: true });
}

const integrationFiles = readdirSync(integrationDir)
  .filter((name) => name.endsWith('.integration.test.ts'))
  .sort()
  .map((name) => `./src/integration/${name}`);

if (integrationFiles.length === 0) {
  throw new Error(`No integration test files found in ${integrationDir}`);
}

resetArtifactsRoot();

const result = Bun.spawnSync({
  cmd: ['bun', 'test', '--isolate', ...integrationFiles],
  cwd: packageRoot,
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env },
});

if (result.exitCode === 0) {
  rmSync(artifactsRoot, { recursive: true, force: true });
}

process.exit(result.exitCode ?? 1);
