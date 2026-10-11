import { expect, test } from 'bun:test';
import { handleHost, hostCommandHelp } from './host';
import { handleAttempt } from './attempt';
import { strictHostFixture } from '../../../core/src/test-support/host-runtime';
import { resolveExecutionContextId } from '@senderos/core';
import { runCli } from '../run';
import { resolveHelp } from '../help';

test('host commands declare identity, grant access, and report workspace availability', async () => {
  const { home, project, attemptId } = await strictHostFixture();
  expect(await handleHost('context-register', [], { name: resolveExecutionContextId(home) }, home)).toMatchObject({ id: resolveExecutionContextId(home) });
  expect(await handleHost('register', ['host', 'register', 'cli-host'], { name: 'CLI Host', capability: ['shell', 'independent_session'], harness: 'custom' }, home)).toMatchObject({ id: 'cli-host', harness: 'custom' });
  expect(await handleHost('register', ['host', 'register', 'cli-host'], { name: 'CLI Host', disabled: true }, home)).toMatchObject({ enabled: false, harness: 'codex' });
  expect(await handleHost('list', [], {}, home)).toHaveLength(2);
  expect(await handleHost('grant', ['host', 'grant', 'cli-host'], { 'project-id': project.id, 'workspace-ref': 'repo:test' }, home)).toMatchObject({ accessGranted: true });
  expect(await handleHost('workspace', ['host', 'workspace', 'cli-host'], { 'project-id': project.id, available: true, 'working-path': '/local' }, home)).toMatchObject({ available: true });
  expect(await handleHost('workspace', ['host', 'workspace', 'cli-host'], { 'project-id': project.id, unavailable: true }, home)).toMatchObject({ available: false });
  expect(await handleHost('discover', ['host', 'discover', 'cli-host'], {}, home)).toEqual([expect.objectContaining({ attemptId })]);
  expect(await handleHost('grant', ['host', 'grant', 'cli-host'], { 'project-id': project.id, 'workspace-ref': 'repo:test', revoke: true }, home)).toMatchObject({ accessGranted: false });
  for (const options of [{}, { available: true, unavailable: true }] as Record<string, string | boolean | string[]>[]) await expect(handleHost('workspace', ['host', 'workspace', 'cli-host'], options, home)).rejects.toThrow('exactly one');
  await expect(handleHost('unknown', [], {}, home)).rejects.toThrow('Unknown host');
  await expect(handleHost('register', [], {}, home)).rejects.toThrow('host id');
  expect(resolveHelp('host')).toBe(hostCommandHelp);
});
test('attempt CLI enforces separate claim/start and accepts all host reconciliation fields', async () => {
  const { home, attemptId } = await strictHostFixture();
  const positions = ['attempt', '', attemptId];
  expect(await handleAttempt('preflight', positions, { 'owner-id': 'host-a' }, home)).toMatchObject({ eligible: true });
  const claim = await handleAttempt('claim', positions, { 'owner-id': 'host-a' }, home);
  if (!claim || !('token' in claim)) throw new Error('Missing claim token');
  expect(await handleAttempt('start', positions, { token: claim.token, 'external-session-id': 'worker', 'parent-session-id': 'main', 'working-path': '/remote/workspace', 'resume-command': 'host resume worker' }, home)).toMatchObject({ status: 'running' });
  expect(await handleAttempt('evidence', positions, { token: claim.token, kind: 'test', label: 'Worker checks passed' }, home)).toMatchObject({ kind: 'test' });
  expect(await handleAttempt('reconcile', positions, { token: claim.token, 'owner-id': 'host-a', outcome: 'unknown', details: 'Inspection unavailable' }, home)).toMatchObject({ outcome: 'unknown' });
  expect(await handleAttempt('reconcile', positions, { token: claim.token, 'owner-id': 'host-a', outcome: 'finished', details: 'Read external worker result', 'external-session-id': 'worker', status: 'failed', 'result-json': '{"exitCode":1}' }, home)).toMatchObject({ status: 'failed' });
});
test('CLI router exposes the host discovery command', async () => {
  const { home } = await strictHostFixture();
  const logs: string[] = [];
  const prior = console.log;
  console.log = (...values: unknown[]) => logs.push(values.join(' '));
  try { await runCli(['host', 'list', '--home', home]); } finally { console.log = prior; }
  expect(JSON.parse(logs[0]!)).toEqual([expect.objectContaining({ id: 'host-a' })]);
});
