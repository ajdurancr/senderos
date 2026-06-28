import { describe, expect, test } from 'bun:test';
import { schedulePlan } from './schedule';
import { initHome } from '../../../../tests/helpers/runtime';

describe('runtime schedule operation', () => {
  test('emits schedule plan', () => {
    const home = initHome();
    expect(schedulePlan(home)).toEqual(expect.objectContaining({ jobName: 'senderos-loop-maintenance', cadence: '*/15 * * * *' }));
  });
});
