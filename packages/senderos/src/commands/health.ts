import { existsSync } from 'node:fs';

import {
  defaultHomePath,
  ensureWithinHome,
  initializeRuntime,
  loadConfig,
  previewInit,
  resolveRuntime,
  runtimeExists,
} from '../shared/config';
import { describeCurrentDb, healthcheckCurrentDb } from '../db/client';

export {
  defaultHomePath,
  initializeRuntime,
  loadConfig,
  previewInit,
  resolveRuntime,
};

export function doctor(home = defaultHomePath()) {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!runtimeExists(home)) {
    issues.push('missing config');
  }

  if (issues.length) {
    return { ok: false, issues, warnings };
  }

  const { config, paths } = resolveRuntime(home);
  const managedPaths = [
    paths.artifactRoot,
    paths.logRoot,
    paths.cacheRoot,
    paths.dbPath,
  ];

  for (const dir of managedPaths.slice(0, 3)) {
    if (!existsSync(dir)) {
      issues.push(`missing dir:${dir}`);
    }
  }

  if (config.guardrails.restrictToHome) {
    for (const candidate of managedPaths) {
      try {
        ensureWithinHome(home, candidate);
      } catch (error) {
        issues.push((error as Error).message);
      }
    }
  }

  const dbHealth = healthcheckCurrentDb(home);
  issues.push(...dbHealth.issues);
  warnings.push(...(dbHealth.warnings ?? []));

  return {
    ok: issues.length === 0,
    issues,
    warnings,
    database: describeCurrentDb(home),
    defaultHarness: config.defaultHarness,
    artifactRoot: paths.artifactRoot,
  };
}
