import { expect, test } from 'bun:test';
import { completeTogether } from './complete-together';

test('preserves tuple order and evaluates lazy queries exactly once', async () => {
  let calls = 0;
  const query = { then(resolve: (value: number) => unknown) { calls++; return Promise.resolve(resolve(42)); } };
  expect(await completeTogether([Promise.resolve('first'), query] as const)).toEqual(['first', 42]);
  expect(calls).toBe(1);
  expect(await completeTogether([])).toEqual([]);
});

test('waits for sibling continuations and retains the original first rejection', async () => {
  const first = new Error('first failure');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let siblingFinished = false;
  let settled = false;
  const result = completeTogether([
    Promise.reject(first),
    gate.then(async () => { await Promise.resolve(); siblingFinished = true; throw new Error('later failure'); }),
  ]).catch(error => { settled = true; return error; });
  await Promise.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);
  release();
  expect(await result).toBe(first);
  expect(siblingFinished).toBe(true);
});
