import { describe, expect, test } from 'bun:test';
import { parseArgs } from './args';

describe('parseArgs', () => {
  test('splits positionals and options', () => {
    expect(parseArgs(['feature','show','abc','--home','/tmp/x','--approve'])).toEqual({ positionals: ['feature','show','abc'], options: { home: '/tmp/x', approve: true } });
  });
});
