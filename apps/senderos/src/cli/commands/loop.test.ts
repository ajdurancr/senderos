import { describe, expect, test } from 'bun:test';

import { resolveHelp } from '../help';

describe('loop command removal', () => {
  test('loop is no longer exposed in cli help', () => {
    expect(resolveHelp('loop').command).toBe('senderos');
  });
});
