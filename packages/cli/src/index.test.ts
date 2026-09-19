import { expect, test } from 'bun:test';

import { runCli as runCliFromEntryPoint } from './index';
import { runCli } from './run';

test('the package entry point exports the CLI runner', () => {
  expect(runCliFromEntryPoint).toBe(runCli);
});
