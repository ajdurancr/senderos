import { Database } from 'bun:sqlite';

import type { DbAdapter } from '../../domain/types';
import { resolveRuntime } from '../../config/runtime';
import { migrate } from '../../db/schema';

export const localSqliteAdapter: DbAdapter = {
  kind: 'local',

  describe(home) {
    const { paths } = resolveRuntime(home);
    return { kind: 'local', dbPath: paths.dbPath };
  },

  healthcheck(home) {
    try {
      const { config } = resolveRuntime(home);
      const db = new Database(config.database.path!);
      migrate(db);
      db.close();
      return { ok: true, issues: [] };
    } catch (error) {
      return { ok: false, issues: [(error as Error).message] };
    }
  },

  openCommandConnection(home) {
    const { config } = resolveRuntime(home);
    const db = new Database(config.database.path!);
    migrate(db);
    return db;
  },
};
