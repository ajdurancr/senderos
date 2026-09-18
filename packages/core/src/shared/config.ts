import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

import type {
  InitPreview,
  SeedAgentsOptions,
  SenderosConfig,
} from '../shared/types';
import { migrateRuntimeDb } from '../db/migrate';
import { seedBuiltInAgents } from '../bootstrap/seed-agents';
import { seedBuiltInSenderos } from '../bootstrap/seed-senderos';
import { inferHarnessFromEnvironment } from './harness';
import { randomId } from './ids';
import { registerExecutionContext } from '../commands/execution-contexts/register';

export function defaultHomePath() {
  return resolve(join(process.cwd(), '.senderos'));
}

export function configPathForHome(home: string) {
  return join(home, 'config.json');
}

function resolveThroughExistingAncestors(path: string) {
  let ancestor = resolve(path);
  const missingSegments: string[] = [];

  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    missingSegments.unshift(basename(ancestor));
    ancestor = parent;
  }

  return resolve(
    existsSync(ancestor) ? realpathSync(ancestor) : ancestor,
    ...missingSegments,
  );
}

export function ensureWithinHome(home: string, target: string) {
  const canonicalHome = resolveThroughExistingAncestors(home);
  const canonicalTarget = resolveThroughExistingAncestors(target);
  const rel = relative(canonicalHome, canonicalTarget);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
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
  executionContextId = randomId('context'),
): SenderosConfig {
  return {
    executionContextId,
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
  executionContext?: { id?: string; name: string },
): InitPreview {
  const inferredHarness = harness ?? inferHarnessFromEnvironment();
  const resolvedHome = resolve(home ?? defaultHomePath());
  const config = defaultConfigForHome(
    resolvedHome,
    inferredHarness === 'unknown' ? 'unknown' : inferredHarness,
    executionContext?.id,
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
      `Execution context: ${executionContext?.name ?? 'name required for initialization'} (${config.executionContextId})`,
    ],
    requiresApproval: true,
  };
}

export async function initializeRuntime(
  home: string,
  config?: SenderosConfig,
  seedOptions?: SeedAgentsOptions,
  executionContextName?: string,
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
  await registerExecutionContext({
    home: resolvedHome,
    id: runtimeConfig.executionContextId,
    name: executionContextName ?? runtimeConfig.executionContextId,
  });
  await seedBuiltInAgents(resolvedHome, seedOptions);
  await seedBuiltInSenderos(resolvedHome);

  return { home: resolvedHome, configPath: configPathForHome(resolvedHome) };
}

export function resolveExecutionContextId(home = defaultHomePath()) {
  if (runtimeExists(home)) {
    const value = loadConfig(home).executionContextId;
    if (value) return value;
  }
  const value = process.env.SENDEROS_EXECUTION_CONTEXT_ID;
  if (value) return value;
  throw new Error(
    'Missing execution context. Run senderos init or set SENDEROS_EXECUTION_CONTEXT_ID.',
  );
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
