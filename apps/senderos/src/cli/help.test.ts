import { describe, expect, test } from 'bun:test';
import { collectHelpLeaves, resolveHelp, rootHelp } from './help';

describe('cli help metadata', () => {
  test('resolves top-level and subcommand help with agent descriptions by default', () => {
    expect(rootHelp.subcommands?.length).toBeGreaterThan(0);
    expect(resolveHelp('goal').command).toBe('goal');
    expect(resolveHelp('agent').subcommands?.map((x) => x.command)).toContain('list');
    expect(resolveHelp('transition').command).toBe('transition');
    expect(resolveHelp('plan').summary).toContain('dispatchable');
    expect(resolveHelp('run').subcommands?.map((x) => x.command)).toContain('dispatch');
    expect(resolveHelp('config', 'set').arguments?.map((x) => x.name)).toEqual(['config-path', 'value']);
    for (const help of collectHelpLeaves(rootHelp)) {
      expect(help.summary.length).toBeGreaterThan(0);
      expect(help.usage.length).toBeGreaterThan(0);
      expect(help.summary.length).toBeGreaterThan(0);
    }
  });

  test('can omit agent descriptions from help output', () => {
    expect(resolveHelp('run', 'dispatch', { omitAgentDescription: true }).agentDescription).toBeUndefined();
  });
});
