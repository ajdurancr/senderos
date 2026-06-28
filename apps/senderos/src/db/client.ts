import type { DbAdapter, SenderosConfig } from "../domain/types";
import { resolveRuntime } from "../config/runtime";
import { localSqliteAdapter, openLocalSqlite } from "../adapters/db/local-sqlite";
import { tursoAdapter } from "../adapters/db/turso";
export function resolveDbAdapter(kind: SenderosConfig["database"]["kind"]): DbAdapter {
  if (kind === "turso") return tursoAdapter;
  return localSqliteAdapter;
}
export function openDb(home?: string) {
  const { config } = resolveRuntime(home);
  if (config.database.kind !== "local") throw new Error("Turso adapter is built in, but synchronous Bun runtime paths still require the local SQLite adapter for command execution.");
  return openLocalSqlite(home);
}
