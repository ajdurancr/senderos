import { expect, test } from 'bun:test';

import { createSenderos } from './index';
import { initHome } from './test-support/runtime';

test('createSenderos scopes the public API to one Senderos home', () => {
  const senderos = createSenderos({ home: initHome() });
  expect(senderos.commands.projects.list()).toEqual([]);
  expect(senderos.missionControl.overview().goals).toEqual([]);
});
