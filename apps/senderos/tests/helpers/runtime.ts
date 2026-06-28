import { afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defaultConfigForHome, initializeRuntime } from '../../src/config/runtime';
import type { SenderosConfig } from '../../src/domain/types';

const homes: string[] = [];

export function tempHome() {
  const home = mkdtempSync(join(tmpdir(), 'senderos-test-'));
  homes.push(home);
  return home;
}

export function initHome(config?: SenderosConfig) {
  const home = tempHome();
  initializeRuntime(home, config);
  return home;
}

export function tursoConfigForHome(home: string): SenderosConfig {
  const config = defaultConfigForHome(home, 'codex');
  return {
    ...config,
    database: {
      kind: 'turso',
      turso: {
        url: 'libsql://senderos.example.turso.io',
        authTokenEnv: 'SENDEROS_TURSO_TOKEN',
      },
    },
  };
}

afterEach(() => {
  while (homes.length) {
    rmSync(homes.pop()!, { recursive: true, force: true });
  }

  delete process.env.SENDEROS_TURSO_TOKEN;
});
