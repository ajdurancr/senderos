import { describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  configPathForHome,
  defaultConfigForHome,
  loadConfig,
  defaultHomePath,
  ensureWithinHome,
  initializeRuntime,
  previewInit,
  resolveRuntime,
  resolveExecutionContextId,
  runtimeExists,
} from './config';
import { createProject } from '../commands/projects/create';
import { listProjects } from '../commands/projects/list';
import { initHome, tempHome } from '../test-support/runtime';

describe('runtime configuration', () => {
  test('defaultHomePath ends in .senderos', () => {
    expect(defaultHomePath()).toContain('.senderos');
  });

  test('previewInit marks runtime creation as approval-gated', () => {
    const preview = previewInit(undefined, 'codex');
    expect(preview.requiresApproval).toBe(true);
  });

  test('preserves preset and custom harness identifiers', () => {
    expect(previewInit(undefined, 'cursor').config.defaultHarness).toBe(
      'cursor',
    );
    expect(previewInit(undefined, 'my-company-agent').config.defaultHarness).toBe(
      'my-company-agent',
    );
  });

  test('initializeRuntime creates a local runtime on disk', async () => {
    const home = await initHome();
    expect(runtimeExists(home)).toBe(true);
  });

  test('initializeRuntime defaults a local database URL when none is configured', async () => {
    const home = tempHome();
    delete process.env.SENDEROS_DATABASE_URL;
    await expect(initializeRuntime(home)).resolves.toMatchObject({ home });
    expect(String(process.env.SENDEROS_DATABASE_URL)).toBe(`file:${home}/senderos.db`);
  });

  test('rejected context registration preserves configuration and retained project identity', async () => {
    const home = await initHome();
    const original = loadConfig(home);
    const before = readFileSync(configPathForHome(home));
    const project = await createProject({ home, name: 'Retained fixture' });
    await expect(initializeRuntime(home, {
      ...original, executionContextId: 'replacement-context',
    }, undefined, original.executionContextId)).rejects.toThrow('name is already in use');
    expect(readFileSync(configPathForHome(home))).toEqual(before);
    expect((await listProjects(home, original.executionContextId)).map(item => item.id)).toEqual([project.id]);
  });

  test('rejected database guardrail preserves existing configuration bytes', async () => {
    const home = await initHome();
    const before = readFileSync(configPathForHome(home));
    process.env.SENDEROS_DATABASE_URL = `file:${join(tempHome(), 'outside.db')}`;
    await expect(initializeRuntime(home, {
      ...loadConfig(home), defaultHarness: 'replacement-fixture',
    })).rejects.toThrow('Guardrail violation');
    expect(readFileSync(configPathForHome(home))).toEqual(before);
  });

  test('database setup failure preserves existing configuration bytes', async () => {
    const home = await initHome();
    const before = readFileSync(configPathForHome(home));
    const invalidDatabase = join(home, 'invalid.db');
    writeFileSync(invalidDatabase, 'synthetic invalid database');
    process.env.SENDEROS_DATABASE_URL = `file:${invalidDatabase}`;
    await expect(initializeRuntime(home, {
      ...loadConfig(home), defaultHarness: 'replacement-fixture',
    })).rejects.toThrow();
    expect(readFileSync(configPathForHome(home))).toEqual(before);
  });

  test('seed failure preserves existing configuration and leaves new homes unpublished', async () => {
    const home = await initHome();
    const before = readFileSync(configPathForHome(home));
    await expect(initializeRuntime(home, {
      ...loadConfig(home), defaultHarness: 'replacement-fixture',
    }, { definitionsDir: join(home, 'missing-seeds') })).rejects.toThrow();
    expect(readFileSync(configPathForHome(home))).toEqual(before);
    const newHome = tempHome();
    process.env.SENDEROS_DATABASE_URL = `file:${join(newHome, 'fixture.db')}`;
    await expect(initializeRuntime(newHome, undefined, {
      definitionsDir: join(newHome, 'missing-seeds'),
    })).rejects.toThrow();
    expect(runtimeExists(newHome)).toBe(false);
  });

  test('failed config publication cleans its temporary file', async () => {
    const home = tempHome();
    mkdirSync(configPathForHome(home));
    process.env.SENDEROS_DATABASE_URL = `file:${join(home, 'fixture.db')}`;
    await expect(initializeRuntime(home)).rejects.toThrow();
    expect(readdirSync(home).filter(name => name.startsWith('.config-'))).toEqual([]);
    expect(readdirSync(configPathForHome(home))).toEqual([]);
  });

  test('successful reinitialization uses the proposed connection before publishing config', async () => {
    const home = await initHome();
    const replacement = { ...loadConfig(home), database: { urlEnv: 'SENDEROS_INIT_FIXTURE_URL' }, defaultHarness: 'replacement-fixture' };
    process.env.SENDEROS_INIT_FIXTURE_URL = `file:${join(home, 'replacement.db')}`;
    try {
      await initializeRuntime(home, replacement);
      expect(loadConfig(home)).toEqual(replacement);
      const project = await createProject({ home, name: 'Replacement database project' });
      expect((await listProjects(home, replacement.executionContextId)).map(item => item.id)).toEqual([project.id]);
    } finally {
      delete process.env.SENDEROS_INIT_FIXTURE_URL;
    }
  });

  test('resolveRuntime returns persisted configuration and paths', async () => {
    const home = await initHome();
    const resolved = resolveRuntime(home);
    expect(resolved.paths.home).toBe(home);
    expect(resolved.config.database.urlEnv).toBe('SENDEROS_DATABASE_URL');
  });

  test('resolves context from config before the environment fallback', async () => {
    const home = await initHome();
    process.env.SENDEROS_EXECUTION_CONTEXT_ID = 'context-environment';
    expect(resolveExecutionContextId(home)).not.toBe('context-environment');
    expect(resolveExecutionContextId(tempHome())).toBe('context-environment');
    delete process.env.SENDEROS_EXECUTION_CONTEXT_ID;
    expect(() => resolveExecutionContextId(tempHome())).toThrow('Missing execution context');
  });

  test('rejects relative and outside-home managed paths', async () => {
    const relativeHome = tempHome();
    const relativeConfig = defaultConfigForHome(relativeHome, 'codex');
    relativeConfig.artifactRoot = 'relative-artifacts';
    await expect(initializeRuntime(relativeHome, relativeConfig)).rejects.toThrow(
      'Path must be absolute',
    );

    const outsideHome = tempHome();
    const outsideConfig = defaultConfigForHome(outsideHome, 'codex');
    outsideConfig.logRoot = '/tmp/outside-senderos-home';
    await expect(initializeRuntime(outsideHome, outsideConfig)).rejects.toThrow(
      'Guardrail violation',
    );
  });

  test('compares canonical paths without allowing symlink escapes', () => {
    const home = tempHome();
    const homeAlias = tempHome();
    rmSync(homeAlias, { recursive: true });
    symlinkSync(home, homeAlias, 'dir');

    const outside = tempHome();
    const outsideAlias = join(home, 'outside-link');
    symlinkSync(outside, outsideAlias, 'dir');

    expect(() => ensureWithinHome(home, join(homeAlias, 'senderos.db'))).not.toThrow();
    expect(() => ensureWithinHome(home, join(outsideAlias, 'senderos.db'))).toThrow(
      'Guardrail violation',
    );
  });
});
