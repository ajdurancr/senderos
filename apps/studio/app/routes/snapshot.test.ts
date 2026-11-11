import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../features/mission-control/server', () => ({ missionControlData: vi.fn() }));
import { missionControlData } from '../features/mission-control/server';
import { loader } from './snapshot';
afterEach(() => vi.resetAllMocks());
it('retains pathname, scope and selected history in the read-only snapshot request', async () => {
  vi.mocked(missionControlData).mockResolvedValueOnce({ asOf: 123 } as Awaited<ReturnType<typeof missionControlData>>);
  const response = await loader({ request: new Request('http://localhost/resources/snapshot?_pathname=%2Fprojects%2Fp%2Fruns&context=c&history=all') });
  expect(await response.json()).toEqual({ ok: true, data: { asOf: 123 } });
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(missionControlData).toHaveBeenCalledOnce();
  expect(vi.mocked(missionControlData).mock.calls[0][0]?.url).toBe('http://localhost/projects/p/runs?context=c&history=all');
});
it('returns a bounded retryable error without leaking database details', async () => {
  vi.mocked(missionControlData).mockRejectedValueOnce(new Error('synthetic secret URL'));
  const response = await loader({ request: new Request('http://localhost/resources/snapshot') });
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false });
});
it.each(['//outside.invalid', 'https://outside.invalid', '/runs?project=other', '/runs#other'])('rejects invalid path %s', async path => {
  const response = await loader({ request: new Request(`http://localhost/resources/snapshot?_pathname=${encodeURIComponent(path)}`) });
  expect(response.status).toBe(400);
  expect(missionControlData).not.toHaveBeenCalled();
});
