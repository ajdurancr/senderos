import { expect, test } from 'bun:test';
import { strictHostFixture } from '../../test-support/host-runtime';
import { canReadAttempt, inspectAttempt } from './inspection';
import { getRunAttempt } from './get';
import { listRunAttempts } from './list';
import { grantHostWorkspace } from '../../lifecycle/host-registry';
import type { RunAttemptRecord } from '../../shared/types';

test('inspection exposes safe assignment data across explicit grants while excluding tokens', async () => {
  const { home, attemptId, project, hostApi } = await strictHostFixture(true);
  const claim = await hostApi.claim(); await hostApi.start(claim.token);
  const attempt = (await getRunAttempt(attemptId, home, 'remote'))!;
  expect(attempt.ownerId).toBe('host-a');
  expect(JSON.stringify(attempt)).not.toContain(claim.token);
  expect(await getRunAttempt(attemptId, home, 'unrelated')).toBeNull();
  expect(await listRunAttempts(undefined, home, 'remote')).toHaveLength(1);
  expect(await listRunAttempts(undefined, home, 'unrelated')).toHaveLength(0);
  expect(await canReadAttempt(attempt, project.executionContextId, home)).toBe(true);
  await grantHostWorkspace({ hostId: 'host-a', projectId: project.id, workspaceRef: 'repo', revoke: true }, home);
  expect(await canReadAttempt(attempt, 'remote', home)).toBe(true);
  expect(await canReadAttempt({ ...attempt, runId: 'missing' } as RunAttemptRecord, 'remote', home)).toBe(false);
  const absentClaim = await inspectAttempt({ ...attempt, id: 'missing', statusSnapshotJson: '{}' }, home);
  expect(absentClaim).toMatchObject({ ownerId: null, leaseExpiresAt: null, protocolVersion: 1, preflight: null, recoveryDetails: {} });
});
