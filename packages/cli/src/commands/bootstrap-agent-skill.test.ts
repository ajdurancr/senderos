import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleBootstrapAgentSkill } from './bootstrap-agent-skill';
import { tempHome } from '../../../core/src/test-support/runtime';

describe('bootstrap-agent-skill command', () => {
  const canonicalSkill = readFileSync(
    new URL('../skills/senderos-operator/SKILL.md', import.meta.url),
    'utf8',
  );

  test('prints without writing when requested', async () => {
    const path = join(tempHome(), 'SKILL.md');
    const result = await handleBootstrapAgentSkill({
      path,
      print: true,
    });
    expect(result.mode).toBe('print');
    expect(result.content).toBe(canonicalSkill);
    expect(existsSync(path)).toBe(false);
  });

  test('creates and force-overwrites a skill scaffold', async () => {
    const path = join(tempHome(), 'SKILL.md');
    expect((await handleBootstrapAgentSkill({ path })).created).toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(canonicalSkill);
    await expect(handleBootstrapAgentSkill({ path })).rejects.toThrow(
      'Skill already exists',
    );
    expect(
      (await handleBootstrapAgentSkill({ path, force: true })).overwritten,
    ).toBe(true);
  });
});
