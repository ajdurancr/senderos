import { expect, test } from 'bun:test';
import { strictHostFixture } from '../test-support/host-runtime';
import { scopedApi } from './scope';
import { withAttemptHostAccess } from './host-access';
import { updateRunAttempt } from '../commands/attempts/update';

test('only an assigned host with its exact token may report across contexts', async () => {
  const { home, attemptId, hostApi } = await strictHostFixture(true);
  const remote = scopedApi({ work: (token?: string) => withAttemptHostAccess(attemptId, token, home, async () => 'allowed') }, 'remote');
  await expect(remote.work()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const claim = await hostApi.claim();
  expect(await remote.work(claim.token)).toBe('allowed');
  await expect(remote.work('wrong')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(scopedApi({ work: () => withAttemptHostAccess(attemptId, claim.token, home, async () => 'wrong') }, 'other').work()).rejects.toMatchObject({ code: 'HOST_NOT_FOUND' });
  expect(await withAttemptHostAccess(attemptId, undefined, home, async () => 'owner context')).toBe('owner context');
  await hostApi.start(claim.token);
  const report = scopedApi({ update: () => updateRunAttempt(attemptId, { token: claim.token, status: 'failed', failureSummary: 'external worker failed' }, home) }, 'remote');
  expect((await report.update()).status).toBe('failed');
});
