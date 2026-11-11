import { statSync } from "node:fs";
import { isAbsolute } from "node:path";
import { describeCurrentDb, healthcheckCurrentDb } from "../../db/client";
import {
  defaultHomePath,
  ensureWithinHome,
  initializeRuntime,
  loadConfig,
  previewInit,
  resolveRuntime,
  runtimeExists,
} from "../../shared/config";
export {
  defaultHomePath,
  initializeRuntime,
  loadConfig,
  previewInit,
  resolveRuntime,
};
function configurationIssues(value: unknown): string[] {
  const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
  const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
  if (!record(value)) return ["invalid config: expected an object"];
  const valid: Record<string, boolean> = {
    executionContextId: text(value.executionContextId),
    database: record(value.database) && text(value.database.urlEnv) &&
      (value.database.authTokenEnv === undefined || text(value.database.authTokenEnv)),
    defaultHarness: text(value.defaultHarness),
    output: record(value.output) && (value.output.format === "json" || value.output.format === "text"),
    guardrails: record(value.guardrails) && typeof value.guardrails.restrictToHome === "boolean",
  };
  for (const field of ["artifactRoot", "logRoot", "cacheRoot"]) {
    valid[field] = text(value[field]) && isAbsolute(value[field]);
  }
  return Object.entries(valid).filter(([, valid]) => !valid).map(([field]) => `invalid config: ${field}`);
}

export async function doctor(home = defaultHomePath()) {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (!runtimeExists(home)) return { ok: false, issues: ["missing config"], warnings };
  let config: ReturnType<typeof loadConfig>;
  try { config = loadConfig(home); }
  catch { return { ok: false, issues: ["invalid config: cannot read or parse config.json"], warnings }; }
  issues.push(...configurationIssues(config));
  if (issues.length) return { ok: false, issues, warnings };
  const managedPaths = [config.artifactRoot, config.logRoot, config.cacheRoot];
  for (const dir of managedPaths) {
    try {
      if (!statSync(dir).isDirectory()) issues.push(`not a directory:${dir}`);
    } catch (error) {
      issues.push((error as NodeJS.ErrnoException).code === "ENOENT" ? `missing dir:${dir}` : `unreadable dir:${dir}`);
    }
    if (config.guardrails.restrictToHome) {
      try { ensureWithinHome(home, dir); }
      catch (error) { issues.push((error as Error).message); }
    }
  }
  const dbHealth = await healthcheckCurrentDb(home);
  issues.push(...dbHealth.issues);
  warnings.push(...(dbHealth.warnings ?? []));
  return {
    ok: issues.length === 0,
    issues,
    warnings,
    database: describeCurrentDb(home),
    defaultHarness: config.defaultHarness,
    artifactRoot: config.artifactRoot,
  };
}
