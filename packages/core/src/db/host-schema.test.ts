import { expect, test } from 'bun:test';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { executionHosts, hostWorkspaces } from './host-schema';

test('host registry indexes context and uniquely binds each host to one project workspace', () => {
  expect(getTableConfig(executionHosts).indexes.map(index => index.config.name)).toEqual(['idx_execution_hosts_context']);
  const workspaceIndex = getTableConfig(hostWorkspaces).indexes[0]!;
  expect(workspaceIndex.config.name).toBe('idx_host_workspaces_host_project');
  expect(workspaceIndex.config.unique).toBe(true);
});
