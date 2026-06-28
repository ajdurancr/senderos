import { describe, expect, test } from 'bun:test';
import { resolveHome, requirePositional } from './shared';

describe('cli shared helpers', () => {
  test('resolveHome and requirePositional behave correctly', () => {
    expect(resolveHome('/tmp/x')).toBe('/tmp/x');
    expect(requirePositional('abc', 'name')).toBe('abc');
    expect(() => requirePositional(undefined, 'name')).toThrow('Missing required argument: name');
  });
});
