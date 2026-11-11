import {
  existsSync,
  lstatSync,
  mkdirSync,
  readlinkSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  isAbsolute,
  join,
  parse,
  relative,
  resolve,
  sep,
} from 'node:path';

import type {
  InitPreview,
  SeedAgentsOptions,
  SenderosConfig,
} from '../shared/types';
import { withDatabaseConnection } from '../db/client';
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
  // Resolve links before subsequent ".." segments, just as filesystem opens do.
  // lstat also sees dangling links, whose missing destinations still need fencing.
  const absolutePath = isAbsolute(path) ? path : `${process.cwd()}${sep}${path}`;
  const root = parse(absolutePath).root;
  let current = root;
  let segments = absolutePath.slice(root.length).split(sep);
  let followedLinks = 0;
  while (segments.length) {
    const segment = segments.shift()!;
    if (!segment || segment === '.') continue;
    if (segment === '..') { current = dirname(current); continue; }
    const candidate = join(current, segment);
    let entry;
    try { entry = lstatSync(candidate); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      current = candidate;
      continue;
    }
    if (!entry.isSymbolicLink()) { current = candidate; continue; }
    if (++followedLinks > 40) throw new Error('Guardrail violation: too many symbolic links in managed path.');
    const destination = readlinkSync(candidate);
    if (isAbsolute(destination)) {
      current = parse(destination).root;
      segments = [...destination.slice(current.length).split(sep), ...segments];
    } else segments = [...destination.split(sep), ...segments];
  }
  return current;
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

  const databaseUrl =
    process.env[runtimeConfig.database.urlEnv] ??
    `file:${join(resolvedHome, 'senderos.db')}`;
  process.env[runtimeConfig.database.urlEnv] = databaseUrl;
  // libSQL accepts case-insensitive schemes and percent-decodes the URI path.
  // Authority/options are not filename segments; leave their validation to the driver.
  const filePath = /^file:(?:\/\/[^/?#]*)?([^?#]*)/i.exec(databaseUrl)?.[1];
  if (filePath !== undefined && runtimeConfig.guardrails.restrictToHome)
    ensureWithinHome(resolvedHome, decodeURIComponent(filePath));

  // Setup must use the proposed connection without publishing an unready identity.
  // Database setup is retryable, but is not one transaction with the config file.
  const authToken = runtimeConfig.database.authTokenEnv
    ? process.env[runtimeConfig.database.authTokenEnv]
    : undefined;
  await withDatabaseConnection({ url: databaseUrl, ...(authToken ? { authToken } : {}) }, async () => {
    await migrateRuntimeDb(resolvedHome);
    await registerExecutionContext({
      home: resolvedHome,
      id: runtimeConfig.executionContextId,
      name: executionContextName ?? runtimeConfig.executionContextId,
    });
    await seedBuiltInAgents(resolvedHome, seedOptions);
    await seedBuiltInSenderos(resolvedHome);
  });

  const pendingConfigPath = join(resolvedHome, `.config-${randomId('init')}.tmp`);
  try {
    writeFileSync(pendingConfigPath, JSON.stringify(runtimeConfig, null, 2), { flag: 'wx' });
    renameSync(pendingConfigPath, configPathForHome(resolvedHome));
  } finally {
    rmSync(pendingConfigPath, { force: true });
  }

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
