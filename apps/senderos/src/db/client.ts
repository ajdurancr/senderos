import { Database } from "bun:sqlite";
import { defaultHomePath, resolveRuntime } from "../config/runtime";
import { migrate } from "./schema";

export function openDb(home = defaultHomePath()) {
  const { config } = resolveRuntime(home);
  if (config.database.kind !== "local") throw new Error("Turso mode is configuration-supported but not executable in this local runtime yet.");
  const db = new Database(config.database.path!);
  migrate(db);
  return db;
}
