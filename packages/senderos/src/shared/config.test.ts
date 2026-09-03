import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';

import {
  defaultHomePath,
  initializeRuntime,
  previewInit,
  resolveRuntime,
  runtimeExists,
} from './config';
import { tempHome } from '../../tests/helpers/runtime';

describe('runtime configuration', () => {
  test('defaultHomePath ends in .senderos', () => {
    expect(defaultHomePath()).toContain('.senderos');
  });

  test('previewInit marks runtime creation as approval-gated', () => {
    const preview = previewInit(undefined, 'codex');
    expect(preview.requiresApproval).toBe(true);
  });

  test('initializeRuntime creates a local runtime on disk', () => {
    const home = tempHome();
    initializeRuntime(home);
    expect(runtimeExists(home)).toBe(true);
  });

  test('initializeRuntime seeds built-in agents into the runtime database', () => {
    const home = tempHome();
    initializeRuntime(home);

    const db = new Database(resolveRuntime(home).paths.dbPath);
    const row = db.query("select slug from agents where slug='spec-partner'").get() as
      | { slug: string }
      | null;
    db.close();

    expect(row?.slug).toBe('spec-partner');
  });

  test('resolveRuntime returns persisted configuration and paths', () => {
    const home = tempHome();
    initializeRuntime(home);
    const resolved = resolveRuntime(home);
    expect(resolved.paths.home).toBe(home);
    expect(resolved.config.database.kind).toBe('local');
  });
});
