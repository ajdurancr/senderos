import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type PackageManifest = {
  name?: string;
  scripts?: Record<string, string>;
};

const workspaceRoot = resolve(import.meta.dir, '..');
const packageDirectories = [
  ...new Bun.Glob('packages/*/package.json').scanSync({ cwd: workspaceRoot }),
];
const applicationDirectories = [
  ...new Bun.Glob('apps/*/package.json').scanSync({ cwd: workspaceRoot }),
];
const manifests = [...packageDirectories, ...applicationDirectories]
  .map((manifestPath) => ({
    manifestPath,
    manifest: JSON.parse(
      readFileSync(join(workspaceRoot, manifestPath), 'utf8'),
    ) as PackageManifest,
  }));

const packagesWithoutCoverage = manifests
  .filter(({ manifestPath }) => manifestPath.startsWith('packages/'))
  .filter(({ manifest }) => !manifest.scripts?.coverage)
  .map(({ manifest }) => manifest.name ?? 'unnamed package');

if (packagesWithoutCoverage.length) {
  throw new Error(
    `Every package must define a coverage script. Missing: ${packagesWithoutCoverage.join(', ')}`,
  );
}

const coveredWorkspaces = manifests.filter(
  ({ manifest }) => manifest.scripts?.coverage,
);

for (const { manifestPath, manifest } of coveredWorkspaces) {
  const cwd = resolve(workspaceRoot, manifestPath, '..');
  if (!existsSync(cwd)) throw new Error(`Workspace not found: ${cwd}`);
  console.log(`\n==> ${manifest.name ?? manifestPath}`);
  const result = Bun.spawnSync(['bun', 'run', 'coverage'], {
    cwd,
    env: process.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0) process.exit(result.exitCode);
}
