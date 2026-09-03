import { describe, expect, test } from 'bun:test';
import { parseArgs } from './args';

describe('parseArgs', () => {
  test('splits positionals and options', () => {
    expect(
      parseArgs(['feature', 'show', 'abc', '--home', '/tmp/x', '--approve']),
    ).toEqual({
      positionals: ['feature', 'show', 'abc'],
      options: { home: '/tmp/x', approve: true },
    });
  });

  test('collects repeated options into arrays', () => {
    expect(
      parseArgs([
        'plan',
        '--feature-status',
        'active',
        '--feature-status',
        'failed',
      ]).options['feature-status'],
    ).toEqual(['active', 'failed']);
  });
});
