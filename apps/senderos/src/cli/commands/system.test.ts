import { describe, expect, test } from 'bun:test';
import { handleSystemCommand } from './system';
import { initHome } from '../../../tests/helpers/runtime';

describe('system commands', () => {
  test('doctor reports runtime health', () => {
    const home = initHome();
    expect((handleSystemCommand('doctor', home) as any).database.kind).toBe('local');
  });

  test('status reports runtime summary', () => {
    const home = initHome();
    expect((handleSystemCommand('status', home) as any).openFeatures).toBe(0);
  });

  test('reconcile returns an empty repair set on a healthy runtime', () => {
    const home = initHome();
    expect((handleSystemCommand('reconcile', home) as any).repairedSessions).toEqual([]);
  });

  test('supervise-active orchestrates active features', () => {
    const home = initHome();
    expect((handleSystemCommand('supervise-active', home) as any).results).toBeTruthy();
  });

  test('schedule-plan returns the maintenance job plan', () => {
    const home = initHome();
    expect((handleSystemCommand('schedule-plan', home) as any).jobName).toBe('senderos-supervision-maintenance');
  });

  test('unknown commands throw', () => {
    const home = initHome();
    expect(() => handleSystemCommand('wat', home)).toThrow('Unknown command: wat');
  });
});
