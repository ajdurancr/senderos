import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import { resolveRuntime } from '../shared/config';
import * as schema from './schema';

/** Opens a local or remote libSQL connection from environment-only config. */
export function openRuntimeDb(home?: string) {
  const { config } = resolveRuntime(home);
  const url = process.env[config.database.urlEnv];
  if (!url) throw new Error(`Missing env:${config.database.urlEnv}`);
  const authToken = config.database.authTokenEnv
    ? process.env[config.database.authTokenEnv]
    : undefined;
  return drizzle({
    client: createClient({ url, ...(authToken ? { authToken } : {}) }),
    schema,
  });
}

export function describeCurrentDb(home?: string) {
  const { config } = resolveRuntime(home);
  return {
    urlEnv: config.database.urlEnv,
    url: process.env[config.database.urlEnv] ?? null,
    authTokenEnv: config.database.authTokenEnv ?? null,
  };
}

export async function healthcheckCurrentDb(home?: string) {
  try {
    await openRuntimeDb(home).select().from(schema.projects).limit(1);
    return { ok: true, issues: [] as string[], warnings: [] as string[] };
  } catch (error) {
    return {
      ok: false,
      issues: [(error as Error).message],
      warnings: [] as string[],
    };
  }
}
