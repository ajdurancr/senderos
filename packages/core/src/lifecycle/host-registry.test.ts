import { expect, test } from 'bun:test';
import { capabilities, declareHostWorkspace, discoverHostAttempts, grantHostWorkspace, hostPreflight, listHosts, registerHost, requireHost } from './host-registry';
import { strictHostFixture } from '../test-support/host-runtime';
import { scopedApi } from './scope';
import { initHome } from '../test-support/runtime';
import { registerExecutionContext } from '../commands/execution-contexts/register';

test('capabilities are validated, deduplicated, and sorted', () => {
  expect(capabilities(['z', 'shell', 'z'])).toEqual(['shell', 'z']);
  for (const value of [null, {}, [''], ['with spaces'], [3]]) expect(() => capabilities(value)).toThrow();
});
test('registration is scoped, preserves identity, and supports capabilities and disabled hosts', async () => {
  const { home, hostApi } = await strictHostFixture();
  expect((await listHosts(home))[0]!.harness).toBe('custom-tool');
  expect((await hostApi.register([], false)).enabled).toBe(false);
  await expect(registerHost({ id: '', name: '', capabilities: [] }, home)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(registerHost({ id: 'other', name: 'Other', harness: 'unknown', capabilities: [] }, home)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  await expect(requireHost('missing', home)).rejects.toMatchObject({ code: 'HOST_NOT_FOUND' });
  const global = scopedApi({ list: () => listHosts(home), register: () => registerHost({ id: 'x', name: 'X', capabilities: [] }, home) }, undefined);
  expect(await global.list()).toHaveLength(1);
  await expect(global.register()).rejects.toMatchObject({ code: 'CONTEXT_REQUIRED' });
  await registerExecutionContext({ home, id: 'second', name: 'Second' });
  await expect(scopedApi({ register: () => registerHost({ id: 'host-a', name: 'Conflict', capabilities: [] }, home) }, 'second').register()).rejects.toMatchObject({ code: 'HOST_CONTEXT_CONFLICT' });
  await expect(scopedApi({ register: () => registerHost({ id: 'new', name: 'New', capabilities: [] }, home) }, 'absent').register()).rejects.toMatchObject({ code: 'CONTEXT_REQUIRED' });
});
test('project grants and host declarations are separate; missing capability or workspace blocks preflight', async () => {
  const { home, project, hostApi, attemptId } = await strictHostFixture(true);
  const remote = scopedApi({ preflight: () => hostPreflight({ attemptId, ownerId: 'host-a' }, home), discover: () => discoverHostAttempts('host-a', home), grant: () => grantHostWorkspace({ hostId: 'host-a', projectId: project.id, workspaceRef: 'repo' }, home) }, 'remote');
  expect((await remote.preflight()).eligible).toBe(true);
  expect((await remote.discover())[0]!.attemptId).toBe(attemptId);
  await expect(remote.grant()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await hostApi.register(['shell'], false);
  await hostApi.workspace(false);
  const blocked = await remote.preflight();
  expect(blocked.blockers).toEqual(['host_disabled', 'workspace_unavailable', 'missing_capabilities']);
  expect(blocked.missingCapabilities).toEqual(['independent_session']);
  await expect(hostApi.claim()).rejects.toMatchObject({ code: 'PREFLIGHT_FAILED' });
  await grantHostWorkspace({ hostId: 'host-a', projectId: project.id, workspaceRef: 'repo', revoke: true }, home);
  await expect(remote.preflight()).rejects.toMatchObject({ code: 'WORKSPACE_NOT_GRANTED' });
  await expect(hostApi.workspace()).rejects.toMatchObject({ code: 'WORKSPACE_NOT_GRANTED' });
  expect(await remote.discover()).toHaveLength(0);
  await expect(grantHostWorkspace({ hostId: 'host-a', projectId: project.id, workspaceRef: ' ' }, home)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
});
test('host declaration requires a path, and preflight does not disclose ungranted or nonexistent attempts', async () => {
  const { home, project, attemptId } = await strictHostFixture();
  await expect(declareHostWorkspace({ hostId: 'host-a', projectId: project.id, available: true }, home)).rejects.toMatchObject({ code: 'WORKSPACE_PATH_REQUIRED' });
  expect((await declareHostWorkspace({ hostId: 'host-a', projectId: project.id, available: false }, home)).workingPath).toBe('/remote/workspace');
  await expect(hostPreflight({ attemptId: 'missing', ownerId: 'host-a' }, home)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await registerHost({ id: 'host-b', name: 'Host B', capabilities: [] }, home);
  await expect(hostPreflight({ attemptId, ownerId: 'host-b' }, home)).rejects.toMatchObject({ code: 'WORKSPACE_NOT_GRANTED' });
});
test('default harness comes from runtime config', async () => {
  const home = await initHome();
  expect((await registerHost({ id: 'local', name: 'Local', capabilities: [] }, home)).harness).toBe('codex');
});

import { createSenderos } from '../index';
test('the public scoped facade exposes host coordination and independent-session operations', async () => {
  const { home, project, attemptId } = await strictHostFixture();
  const api = createSenderos({ home });
  expect((await api.commands.hosts.register({ id: 'host-a', name: 'Host A', capabilities: ['shell', 'independent_session'] })).harness).toBe('codex');
  expect(await api.commands.hosts.list()).toHaveLength(1);
  await api.commands.hosts.grant({ hostId: 'host-a', projectId: project.id, workspaceRef: 'repo:facade' });
  await api.commands.hosts.workspace({ hostId: 'host-a', projectId: project.id, available: true, workingPath: '/facade' });
  expect((await api.commands.hosts.preflight({ attemptId, ownerId: 'host-a' })).eligible).toBe(true);
  expect(await api.commands.hosts.discover('host-a')).toHaveLength(1);
  const claim = await api.commands.attempts.claim({ attemptId, ownerId: 'host-a' });
  await api.commands.attempts.start({ attemptId, token: claim.token, externalSessionId: 'worker', parentSessionId: 'main', workingPath: '/facade' });
  expect((await api.commands.attempts.heartbeat({ attemptId, token: claim.token })).cancellationRequested).toBe(false);
  expect((await api.commands.attempts.reconcile({ attemptId, token: claim.token, ownerId: 'host-a', outcome: 'unknown', details: 'Process registry temporarily unavailable' })).outcome).toBe('unknown');
  expect((await api.commands.attempts.abandon({ attemptId, confirmedStopped: true, reason: 'Worker was stopped by operator' })).status).toBe('failed');
});
