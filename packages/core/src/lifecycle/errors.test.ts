import { expect, test } from 'bun:test';
import { LifecycleError, requireLifecycle } from './errors';
test('errors preserve machine-readable recovery information', () => {
  const error = new LifecycleError('BUSY', 'Try later', true, 'retry');
  expect(error).toMatchObject({ code: 'BUSY', retryable: true, nextAction: 'retry' });
  expect(() => requireLifecycle(false, 'INVALID', 'Invalid input')).toThrow('Invalid input');
  expect(() => requireLifecycle(true, 'INVALID', 'unused')).not.toThrow();
});
