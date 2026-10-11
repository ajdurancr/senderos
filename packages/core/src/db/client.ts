import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { AsyncLocalStorage } from "node:async_hooks";

import { resolveRuntime } from "../shared/config";
import * as schema from "./schema";

export type DatabaseConnection = {
  url: string;
  authToken?: string;
};

export function databaseConnectionFromEnvironment(): DatabaseConnection {
  const url = process.env.SENDEROS_DATABASE_URL;
  if (!url) throw new Error("Missing env:SENDEROS_DATABASE_URL");
  const authToken = process.env.SENDEROS_DATABASE_AUTH_TOKEN;
  return { url, ...(authToken ? { authToken } : {}) };
}

/** Opens a local or remote libSQL connection from environment-only config. */
function connectRuntimeDb(home?: string) {
  const connection = home
    ? connectionFromRuntimeConfig(home)
    : databaseConnectionFromEnvironment();
  return drizzle({ client: createClient(connection), schema });
}

type RuntimeDb = ReturnType<typeof connectRuntimeDb>;
const transactions = new AsyncLocalStorage<{ db: RuntimeDb; home?: string }>();
export function openRuntimeDb(home?: string): RuntimeDb {
  const current = transactions.getStore();
  if (current && current.home === home) return current.db;
  return connectRuntimeDb(home);
}

/** Nested commands share the same write transaction, including their events. */
export async function atomic<T>(home: string | undefined, work: () => Promise<T>): Promise<T> {
  const current = transactions.getStore();
  if (current) {
    if (current.home !== home) throw new Error("Cannot mix runtimes in one transaction");
    return work();
  }
  // A shared file can have independent CLI writers. Retry only rolled-back lock
  // contention, yielding the event loop so an in-process owner can commit too.
  const deadline = Date.now() + 5000;
  let delay = 5;
  for (;;) {
    const db = connectRuntimeDb(home);
    try {
      return await db.transaction((tx) => transactions.run(
        { db: tx as unknown as RuntimeDb, home }, work,
      ), { behavior: "immediate" });
    } catch (error) {
      const code = (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code;
      if (!code?.startsWith("SQLITE_BUSY") || Date.now() >= deadline) throw error;
    } finally { db.$client.close(); }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 100);
  }
}

export function describeCurrentDb(home?: string) {
  if (!home) {
    const connection = databaseConnectionFromEnvironment();
    return {
      urlEnv: "SENDEROS_DATABASE_URL",
      url: connection.url,
      authTokenEnv: "SENDEROS_DATABASE_AUTH_TOKEN",
    };
  }
  const { config } = resolveRuntime(home);
  return {
    urlEnv: config.database.urlEnv,
    url: process.env[config.database.urlEnv] ?? null,
    authTokenEnv: config.database.authTokenEnv ?? null,
  };
}

function connectionFromRuntimeConfig(home: string): DatabaseConnection {
  const { config } = resolveRuntime(home);
  const url = process.env[config.database.urlEnv];
  if (!url) throw new Error(`Missing env:${config.database.urlEnv}`);
  const authToken = config.database.authTokenEnv
    ? process.env[config.database.authTokenEnv]
    : undefined;
  return { url, ...(authToken ? { authToken } : {}) };
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
