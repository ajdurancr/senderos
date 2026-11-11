import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { getTableColumns, getTableName } from "drizzle-orm";
import { AsyncLocalStorage } from "node:async_hooks";
import { lstatSync, realpathSync, statSync } from "node:fs";
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
function connectRuntimeDb(home?: string, requireExistingFile = false) {
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
      if (requireExistingFile) {
        try {
          if (!statSync(path).isFile()) throw new Error(`not a database file:${path}`);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`missing database:${path}`);
          throw error;
        }
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
      if (db.$client.protocol === "file") {
        // libsql's local prepared COMMIT can retain a lock after SQLITE_BUSY,
        // even after rollback/close. Keep this client attached and commit via
        // executeMultiple (native exec), which also rolls back a failed commit.
        // Remote clients still require the driver's pinned transaction below.
        await db.$client.execute("BEGIN IMMEDIATE");
        let result: T;
        try {
          result = await transactions.run({ db, home }, work);
        } catch (error) {
          await db.$client.executeMultiple("ROLLBACK");
          throw error;
        }
        await db.$client.executeMultiple("COMMIT");
        return result;
      }
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

/** Checks required table/column availability, not data integrity or schema constraints. */
export async function healthcheckCurrentDb(home?: string) {
  let db: RuntimeDb | undefined;
  try {
    const current = transactions.getStore();
    // The driver creates missing local files on open. Diagnose absence before
    // opening a fresh client; operational connections keep creation semantics.
    db = current && current.home === home ? current.db : connectRuntimeDb(home, true);
    const required = Object.values(schema).map(table => ({
      name: getTableName(table), columns: Object.values(getTableColumns(table)).map(column => column.name),
    }));
    // One metadata query, independent of retained row/history volume. The schema
    // module is the source of required names; extra tables and columns are valid.
    const result = await db.$client.execute({
      sql: `SELECT s.name AS table_name, p.name AS column_name
        FROM sqlite_schema AS s JOIN pragma_table_info(s.name) AS p
        WHERE s.type = 'table' AND s.name IN (${required.map(() => '?').join(', ')})`,
      args: required.map(table => table.name),
    });
    const available = new Map<string, Set<string>>();
    for (const row of result.rows) {
      const name = String(row.table_name);
      if (!available.has(name)) available.set(name, new Set());
      available.get(name)!.add(String(row.column_name));
    }
    const issues: string[] = [];
    for (const table of required) {
      const columns = available.get(table.name);
      if (!columns) issues.push(`missing table:${table.name}`);
      else for (const column of table.columns)
        if (!columns.has(column)) issues.push(`missing column:${table.name}.${column}`);
    }
    return { ok: issues.length === 0, issues, warnings: [] as string[] };
  } catch (error) {
    return {
      ok: false,
      issues: [(error as Error).message],
      warnings: [] as string[],
    };
  } finally {
    if (db && db !== transactions.getStore()?.db) db.$client.close();
  }
}
