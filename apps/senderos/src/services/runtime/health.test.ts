import { describe, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { doctor } from './health';
import { resolveRuntime } from '../../config/runtime';
import { initHome, tempHome } from '../../../tests/helpers/runtime';

describe('runtime health operations', () => {
  test('reports doctor failures for missing config and directories', () => {
    expect(doctor(tempHome()).ok).toBe(false);
    const home = initHome();
    const logRoot = resolveRuntime(home).paths.logRoot;
    rmSync(logRoot, { recursive: true, force: true });
    expect(doctor(home).issues).toContain(`missing dir:${logRoot}`);
  });
});
