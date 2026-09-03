import { describe, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { doctor } from './health';
import { resolveRuntime } from '../shared/config';
import { initHome, tempHome } from '../test-support/runtime';

describe('runtime health operations', () => {
  test('reports doctor failures for missing config and directories', () => {
    expect(doctor(tempHome()).ok).toBe(false);
    const home = initHome();
    const logRoot = resolveRuntime(home).paths.logRoot;
    rmSync(logRoot, { recursive: true, force: true });
    expect(doctor(home).issues).toContain(`missing dir:${logRoot}`);
  });
});
