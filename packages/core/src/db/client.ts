import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { AsyncLocalStorage } from "node:async_hooks";
import { lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

export function databaseResetLockPath(databasePath: string) {
  return `${databasePath}.senderos-reset.lock`;
}

/** A cooperative fence for new clients; already-open external clients must be stopped. */
export function assertNoDatabaseReset(databasePath: string) {
  try { lstatSync(databaseResetLockPath(databasePath)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Database reset lock exists: ${databaseResetLockPath(databasePath)}. Stop clients and inspect it; locks are never removed automatically.`);
}

const connections = new AsyncLocalStorage<{ connection: DatabaseConnection; clients: Set<ReturnType<typeof createClient>> }>();

/** Internal scoped override for rebuilding a disposable database without changing process.env. */
export async function withDatabaseConnection<T>(connection: DatabaseConnection, work: () => Promise<T>): Promise<T> {
  if (transactions.getStore()) throw new Error("Cannot override a database inside a transaction");
  const clients = new Set<ReturnType<typeof createClient>>();
  try { return await connections.run({ connection, clients }, work); }
  finally { for (const client of clients) client.close(); }
}

/** Opens a local or remote libSQL connection from the effective runtime config. */
function connectRuntimeDb(home?: string) {
  const scoped = connections.getStore();
  const connection = scoped?.connection ?? (home
    ? connectionFromRuntimeConfig(home)
    : databaseConnectionFromEnvironment());
  if (/^file:/i.test(connection.url)) {
    const rawPath = connection.url.slice(5).split(/[?#]/)[0]!;
    const decodedPath = decodeURIComponent(rawPath);
    if (decodedPath !== ":memory:") {
      const path = rawPath.startsWith("//")
        ? fileURLToPath(new URL(connection.url)) : resolve(decodedPath);
      assertNoDatabaseReset(path);
      try { assertNoDatabaseReset(realpathSync(path)); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
  // Accept Turso's URL alias without changing the configured value or other schemes.
  const client = createClient({
    ...connection,
    url: connection.url.replace(/^turso:\/\//i, "libsql://"),
  });
  scoped?.clients.add(client);
  return drizzle({ client, schema });
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
