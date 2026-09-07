import { expect, test } from 'bun:test';

import { createSenderos } from './index';
import { initHome } from './test-support/runtime';

test('createSenderos scopes the public API to one Senderos home', async () => {
  const senderos = createSenderos({ home: await initHome() });
  expect(await senderos.commands.projects.list()).toEqual([]);
  expect((await senderos.missionControl.overview()).goals).toEqual([]);
});
