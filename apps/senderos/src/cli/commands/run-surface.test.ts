import { describe, expect, test } from 'bun:test';

import { resolveHelp } from '../help';

describe('command fallback behavior', () => {
  test('unknown command lookup falls back to root help', () => {
    expect(resolveHelp('wat').command).toBe('senderos');
  });
});
