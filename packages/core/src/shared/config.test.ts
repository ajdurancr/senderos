import { describe, expect, test } from 'bun:test';

import {
  defaultConfigForHome,
  defaultHomePath,
  initializeRuntime,
  previewInit,
  resolveRuntime,
  resolveExecutionContextId,
  runtimeExists,
} from './config';
import { initHome, tempHome } from '../test-support/runtime';

describe('runtime configuration', () => {
  test('defaultHomePath ends in .senderos', () => {
    expect(defaultHomePath()).toContain('.senderos');
  });

  test('previewInit marks runtime creation as approval-gated', () => {
    const preview = previewInit(undefined, 'codex');
    expect(preview.requiresApproval).toBe(true);
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
});
