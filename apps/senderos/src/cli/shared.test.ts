import { describe, expect, test } from 'bun:test';
import { optionString, optionStrings, resolveHome, requirePositional } from './shared';

describe('cli shared helpers', () => {
  test('resolveHome and requirePositional behave correctly', () => {
    expect(resolveHome('/tmp/x')).toBe('/tmp/x');
    expect(requirePositional('abc', 'name')).toBe('abc');
    expect(() => requirePositional(undefined, 'name')).toThrow('Missing required argument: name');
  });

  test('normalizes single, repeated, and absent option values', () => {
    expect(optionString(['first', 'last'])).toBe('last');
    expect(optionString('value')).toBe('value');
    expect(optionString(true)).toBeUndefined();
    expect(optionStrings(['active', 'failed'])).toEqual(['active', 'failed']);
    expect(optionStrings('active')).toEqual(['active']);
    expect(optionStrings(true)).toEqual([]);
  });
});
