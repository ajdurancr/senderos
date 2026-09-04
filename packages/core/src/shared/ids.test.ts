import { describe, expect, test } from 'bun:test';
import { now, randomId } from './ids';

describe('common utils', () => {
  test('creates timestamps and prefixed ids', () => {
    const timestamp = now();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
    expect(randomId('feature')).toMatch(/^feature-[a-z0-9]{8}$/);
  });
});
