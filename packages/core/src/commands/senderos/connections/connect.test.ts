import { draftSendero } from '../../../lifecycle/versions';
import { expect, test } from 'bun:test';
import { initHome } from '../../../test-support/runtime';
import { connectSenderoAgents } from './connect';

test('supports conditional backedges and self-retries in directed graphs', async () => {
  const home = await initHome();
  await draftSendero('software-delivery', home);
  const edge = await connectSenderoAgents({ home, senderoId: 'software-delivery', from: 'judge', to: 'judge', condition: { outcome: 'needs_revision' } });
  expect(edge.sourceNodeId).toBe(edge.targetNodeId);
  expect(edge.conditionJson).toBe('{"outcome":"needs_revision"}');
  await expect(connectSenderoAgents({ home, senderoId: 'software-delivery', from: 'judge', to: 'start' })).rejects.toThrow('enter start');
});
