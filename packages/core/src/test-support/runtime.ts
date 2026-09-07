import { afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  defaultConfigForHome,
  initializeRuntime,
} from '../../src/shared/config';
import type { SenderosConfig } from '../../src/shared/types';
import { createProject } from '../../src/commands';

const homes: string[] = [];
const projects: string[] = [];

export function tempHome() {
  const home = mkdtempSync(join(tmpdir(), 'senderos-test-'));
  homes.push(home);
  return home;
}

export function tempProjectDir(
  dirPrefix = 'senderos-demo',
  packageName = dirPrefix,
) {
  const projectRoot = mkdtempSync(join(tmpdir(), `${dirPrefix}-`));
  projects.push(projectRoot);
  writeFileSync(
    join(projectRoot, 'package.json'),
    JSON.stringify(
      {
        name: packageName,
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
  mkdirSync(join(projectRoot, 'src'), { recursive: true });
  writeFileSync(
    join(projectRoot, 'src', 'index.ts'),
    'export const smoke = true;\n',
  );
  return projectRoot;
}

export async function initHome(config?: SenderosConfig) {
  const home = tempHome();
  const runtimeConfig = config ?? defaultConfigForHome(home, 'codex');
  const databaseUrl = `file:${join(home, 'senderos.db')}`;
  process.env[runtimeConfig.database.urlEnv] = databaseUrl;
  await initializeRuntime(home, runtimeConfig);
  return home;
}

export async function createProjectFixture(
  home: string,
  overrides: Partial<Parameters<typeof createProject>[0]> = {},
) {
  return await createProject({
    home,
    name: 'Senderos Demo',
    canonicalPath: tempProjectDir('senderos-demo'),
    githubOwner: 'ajdurancr',
    githubRepo: 'senderos-demo',
    inferredCommands: {
      install: 'bun install',
      build: 'bun run build',
      test: 'bun test',
      lint: 'bun run lint',
    },
    ...overrides,
  });
}

export function tursoConfigForHome(home: string): SenderosConfig {
  const config = defaultConfigForHome(home, 'codex');
  return {
    ...config,
    database: {
      urlEnv: 'SENDEROS_DATABASE_URL',
      authTokenEnv: 'SENDEROS_TURSO_TOKEN',
    },
  };
}

afterEach(() => {
  while (homes.length) {
    rmSync(homes.pop()!, { recursive: true, force: true });
  }

  while (projects.length) {
    rmSync(projects.pop()!, { recursive: true, force: true });
  }

  delete process.env.SENDEROS_TURSO_TOKEN;
  delete process.env.SENDEROS_DATABASE_URL;
});
