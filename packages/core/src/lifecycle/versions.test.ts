import { expect, test } from 'bun:test';
import { initHome } from '../test-support/runtime';
import { draftSendero, editableGraph, publishSendero, setCompletionPolicy } from './versions';
test('draft creation is repeatable and publication validates completion policies', async () => {
  const home = await initHome();
  const first = await draftSendero('software-delivery', home);
  expect((await draftSendero('software-delivery', home))?.version.id).toBe(first?.version.id);
  expect((await editableGraph('software-delivery', home)).version.status).toBe('draft');
  await setCompletionPolicy({ senderoId: 'software-delivery', agent: 'judge', requireReview: true, evidenceKinds: ['ci'] }, home);
  expect((await publishSendero('software-delivery', home))?.version.status).toBe('published');
  await expect(publishSendero('software-delivery', home)).rejects.toMatchObject({ code: 'IMMUTABLE_VERSION' });
});
