import { createClient } from '@libsql/client';

import type { DbAdapter } from '../../domain/types';
import { resolveRuntime } from '../../config/runtime';

export const tursoAdapter: DbAdapter = {
  kind: 'turso',

  describe(home) {
    const { config } = resolveRuntime(home);
    return {
      kind: 'turso',
      url: config.database.turso?.url ?? null,
      authTokenEnv: config.database.turso?.authTokenEnv ?? null,
    };
  },

  healthcheck(home) {
    const { config } = resolveRuntime(home);
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!config.database.turso?.url) issues.push('missing turso url');
    if (!config.database.turso?.authTokenEnv) issues.push('missing turso authTokenEnv');

    const token = config.database.turso?.authTokenEnv
      ? process.env[config.database.turso.authTokenEnv]
      : undefined;

    if (!token) {
      warnings.push(`env:${config.database.turso?.authTokenEnv ?? 'unset'} is not set in this shell`);
    }

    if (!issues.length && token) {
      try {
        createClient({ url: config.database.turso!.url, authToken: token });
      } catch (error) {
        issues.push((error as Error).message);
      }
    }

    return { ok: issues.length === 0, issues, warnings };
  },

  openCommandConnection() {
    throw new Error(
      'Turso is configured through the built-in adapter layer, but command execution has not been migrated to the async libsql execution path yet.'
    );
  },
};
