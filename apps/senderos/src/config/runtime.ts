import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { Database } from "bun:sqlite";
import type { InitPreview, SenderosConfig } from "../domain/types";
import { inferHarnessFromEnvironment } from "../utils/harness";
import { migrate } from "../db/schema";

export function defaultHomePath() { return resolve(join(process.cwd(), ".senderos")); }
export function configPathForHome(home: string) { return join(home, "config.json"); }
export function ensureWithinHome(home: string, target: string) {
  const rel = relative(home, target);
  if (rel.startsWith("..") || (!rel && resolve(target) !== resolve(home))) throw new Error(`Guardrail violation: path outside Senderos home: ${target}`);
}
export function ensureDir(path: string) { mkdirSync(path, { recursive: true }); }
export function runtimeExists(home = defaultHomePath()) { return existsSync(configPathForHome(home)); }
export function loadConfig(home = defaultHomePath()): SenderosConfig { return JSON.parse(readFileSync(configPathForHome(home), "utf8")) as SenderosConfig; }

export function defaultConfigForHome(home: string, harness: SenderosConfig["defaultHarness"]): SenderosConfig {
  return {
    database: { kind: "local", path: join(home, "senderos.db") },
    workspaceRoot: join(home, "workspaces"),
    artifactRoot: join(home, "artifacts"),
    logRoot: join(home, "logs"),
    sessionRoot: join(home, "sessions"),
    cacheRoot: join(home, "cache"),
    defaultHarness: harness,
    output: { format: "json" },
    guardrails: { restrictToHome: true },
  };
}

export function previewInit(home?: string, harness?: SenderosConfig["defaultHarness"]): InitPreview {
  const inferredHarness = harness ?? inferHarnessFromEnvironment();
  const resolvedHome = resolve(home ?? defaultHomePath());
  const config = defaultConfigForHome(resolvedHome, inferredHarness === "unknown" ? "unknown" : inferredHarness);
  return {
    home: resolvedHome,
    configPath: configPathForHome(resolvedHome),
    config,
    inferredHarness,
    assumptions: [
      home ? `Using provided home: ${resolvedHome}` : `No home provided; proposed home is ${resolvedHome}`,
      harness ? `Using provided harness: ${harness}` : `Harness inferred as ${inferredHarness}`,
      `Database adapter: ${config.database.kind}`,
    ],
    requiresApproval: true,
  };
}

export function initializeRuntime(home: string, config?: SenderosConfig) {
  const runtimeConfig = config ?? defaultConfigForHome(resolve(home), inferHarnessFromEnvironment() === "unknown" ? "unknown" : inferHarnessFromEnvironment());
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
    },
  };
}
