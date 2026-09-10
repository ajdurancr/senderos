import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

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
export function openRuntimeDb(home?: string) {
  const connection = home
    ? connectionFromRuntimeConfig(home)
    : databaseConnectionFromEnvironment();
  return drizzle({ client: createClient(connection), schema });
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
