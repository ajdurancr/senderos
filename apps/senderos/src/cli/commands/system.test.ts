import { describe, expect, test } from 'bun:test';
import { handleSystemCommand } from './system';
import { initHome } from '../../../tests/helpers/runtime';

describe('handleSystemCommand', () => {
  test('covers doctor, status, reconcile, schedule-plan, and default error path', () => {
    const home = initHome();
    expect((handleSystemCommand('doctor', home) as any).database.kind).toBe('local');
    expect((handleSystemCommand('status', home) as any).openFeatures).toBe(0);
    expect((handleSystemCommand('reconcile', home) as any).repairedSessions).toEqual([]);
    expect((handleSystemCommand('schedule-plan', home) as any).jobName).toBe('senderos-loop-maintenance');
    expect(() => handleSystemCommand('wat', home)).toThrow('Unknown command: wat');
  });
});
