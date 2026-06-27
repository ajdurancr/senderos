import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { Database } from "bun:sqlite";
import type { RuntimePaths, SenderosConfig } from "../domain/types";
import { migrate } from "../db/schema";

export function defaultHomePath() { return resolve(process.env.SENDEROS_HOME ?? join(process.env.HOME ?? process.cwd(), ".senderos")); }

export function defaultConfigForHome(home: string): SenderosConfig {
  return {
    database: { kind: "local", path: join(home, "senderos.db") },
    workspaceRoot: join(home, "workspaces"),
    artifactRoot: join(home, "artifacts"),
    logRoot: join(home, "logs"),
    sessionRoot: join(home, "sessions"),
    cacheRoot: join(home, "cache"),
    defaultHarness: "openclaw",
    output: { format: "json" },
    guardrails: { restrictToHome: true },
  };
}

export function configPathForHome(home: string) { return join(home, "config.json"); }
export function loadConfig(home = defaultHomePath()): SenderosConfig { return JSON.parse(readFileSync(configPathForHome(home), "utf8")) as SenderosConfig; }

export function ensureWithinHome(home: string, target: string) {
  const rel = relative(home, target);
  if (rel.startsWith("..") || (!rel && resolve(target) !== resolve(home))) throw new Error(`Guardrail violation: path outside Senderos home: ${target}`);
}

export function ensureDir(path: string) { mkdirSync(path, { recursive: true }); }

export function initializeRuntime(home = defaultHomePath(), config?: Partial<SenderosConfig>) {
  const runtimeConfig = { ...defaultConfigForHome(home), ...config } as SenderosConfig;
  ensureDir(home);
  const dirs = [runtimeConfig.workspaceRoot, runtimeConfig.artifactRoot, runtimeConfig.logRoot, runtimeConfig.sessionRoot, runtimeConfig.cacheRoot];
  for (const dir of dirs) {
    if (!isAbsolute(dir)) throw new Error(`Path must be absolute: ${dir}`);
    if (runtimeConfig.guardrails.restrictToHome) ensureWithinHome(home, dir);
    ensureDir(dir);
  }
  writeFileSync(configPathForHome(home), JSON.stringify(runtimeConfig, null, 2));
  if (runtimeConfig.database.kind === "local") {
    const dbPath = runtimeConfig.database.path ?? join(home, "senderos.db");
    if (runtimeConfig.guardrails.restrictToHome) ensureWithinHome(home, dbPath);
    const db = new Database(dbPath);
    migrate(db);
    db.close();
  }
  return { home, configPath: configPathForHome(home) };
}

export function resolveRuntime(home = defaultHomePath()) {
  const config = loadConfig(home);
  return {
    config,
    paths: {
      home,
      configPath: configPathForHome(home),
      dbPath: config.database.path ?? join(home, "senderos.db"),
      workspaceRoot: config.workspaceRoot,
      artifactRoot: config.artifactRoot,
      logRoot: config.logRoot,
      sessionRoot: config.sessionRoot,
      cacheRoot: config.cacheRoot,
    } satisfies RuntimePaths,
  };
}

export function runtimeExists(home = defaultHomePath()) {
  return existsSync(configPathForHome(home));
}
