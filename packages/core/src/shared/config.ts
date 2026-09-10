import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

import type {
  InitPreview,
  SeedAgentsOptions,
  SenderosConfig,
} from '../shared/types';
import { migrateRuntimeDb } from '../db/migrate';
import { seedBuiltInAgents } from '../bootstrap/seed-agents';
import { seedBuiltInSenderos } from '../bootstrap/seed-senderos';
import { inferHarnessFromEnvironment } from './harness';

export function defaultHomePath() {
  return resolve(join(process.cwd(), '.senderos'));
}

export function configPathForHome(home: string) {
  return join(home, 'config.json');
}

export function ensureWithinHome(home: string, target: string) {
  const rel = relative(home, target);
  if (rel.startsWith('..') || (!rel && resolve(target) !== resolve(home))) {
    throw new Error(
      `Guardrail violation: path outside Senderos home: ${target}`,
    );
  }
}

export function ensureDir(path: string) {
  mkdirSync(path, { recursive: true });
}

export function runtimeExists(home = defaultHomePath()) {
  return existsSync(configPathForHome(home));
}

export function loadConfig(home = defaultHomePath()): SenderosConfig {
  return JSON.parse(
    readFileSync(configPathForHome(home), 'utf8'),
  ) as SenderosConfig;
}

export function defaultConfigForHome(
  home: string,
  harness: SenderosConfig['defaultHarness'],
): SenderosConfig {
  return {
    database: {
      urlEnv: 'SENDEROS_DATABASE_URL',
      authTokenEnv: 'SENDEROS_DATABASE_AUTH_TOKEN',
    },
    artifactRoot: join(home, 'artifacts'),
    logRoot: join(home, 'logs'),
    cacheRoot: join(home, 'cache'),
    defaultHarness: harness,
    output: { format: 'json' },
    guardrails: { restrictToHome: true },
  };
}

export function previewInit(
  home?: string,
  harness?: SenderosConfig['defaultHarness'],
): InitPreview {
  const inferredHarness = harness ?? inferHarnessFromEnvironment();
  const resolvedHome = resolve(home ?? defaultHomePath());
  const config = defaultConfigForHome(
    resolvedHome,
    inferredHarness === 'unknown' ? 'unknown' : inferredHarness,
  );

  return {
    home: resolvedHome,
    configPath: configPathForHome(resolvedHome),
    config,
    inferredHarness,
    assumptions: [
      home
        ? `Using provided home: ${resolvedHome}`
        : `No home provided; proposed home is ${resolvedHome}`,
      harness
        ? `Using provided harness: ${harness}`
        : `Harness inferred as ${inferredHarness}`,
      `Database URL environment variable: ${config.database.urlEnv}`,
    ],
    requiresApproval: true,
  };
}

export async function initializeRuntime(
  home: string,
  config?: SenderosConfig,
  seedOptions?: SeedAgentsOptions,
) {
  const resolvedHome = resolve(home);
  const inferredHarness = inferHarnessFromEnvironment();
  const runtimeConfig =
    config ??
    defaultConfigForHome(
      resolvedHome,
      inferredHarness === 'unknown' ? 'unknown' : inferredHarness,
    );

  ensureDir(resolvedHome);
  const dirs = [
    runtimeConfig.artifactRoot,
    runtimeConfig.logRoot,
    runtimeConfig.cacheRoot,
  ];

  for (const dir of dirs) {
    if (!isAbsolute(dir)) {
      throw new Error(`Path must be absolute: ${dir}`);
    }

    if (runtimeConfig.guardrails.restrictToHome) {
      ensureWithinHome(resolvedHome, dir);
    }

    ensureDir(dir);
  }

  writeFileSync(
    configPathForHome(resolvedHome),
    JSON.stringify(runtimeConfig, null, 2),
  );

  const databaseUrl =
    process.env[runtimeConfig.database.urlEnv] ??
    `file:${join(resolvedHome, 'senderos.db')}`;
  process.env[runtimeConfig.database.urlEnv] = databaseUrl;
  if (databaseUrl.startsWith('file:') && runtimeConfig.guardrails.restrictToHome)
    ensureWithinHome(resolvedHome, databaseUrl.slice('file:'.length));

  await migrateRuntimeDb(resolvedHome);
  await seedBuiltInAgents(resolvedHome, seedOptions);
  await seedBuiltInSenderos(resolvedHome);

  return { home: resolvedHome, configPath: configPathForHome(resolvedHome) };
}

export function resolveRuntime(home = defaultHomePath()) {
  const config = loadConfig(home);
  return {
    config,
    paths: {
      home,
      configPath: configPathForHome(home),
      dbPath: undefined,
      artifactRoot: config.artifactRoot,
      logRoot: config.logRoot,
      cacheRoot: config.cacheRoot,
    },
  };
}
