import { describe, expect, test } from 'bun:test';
import { defaultInstruction } from './instructions';

describe('defaultInstruction', () => {
  test('returns phase-specific objectives', () => {
    const feature: any = { id:'f', title:'Title' };
    expect(defaultInstruction(feature,'contract').objective).toContain('acceptance criteria');
    expect(defaultInstruction(feature,'implementation').objective).toContain('TDD loop');
    expect(defaultInstruction(feature,'review').objective).toContain('mutation testing');
    expect(defaultInstruction(feature,'mutation').objective).toContain('mutation-confidence');
    expect(defaultInstruction(feature,'done').objective).toBe('No further work required.');
  });
});
