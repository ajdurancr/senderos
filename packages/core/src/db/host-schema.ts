import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** A tool and machine identity, distinct from the context that owns a project. */
export const executionHosts = sqliteTable('execution_hosts', {
  id: text('id').primaryKey(),
  executionContextId: text('execution_context_id').notNull(),
  name: text('name').notNull(),
  harness: text('harness').notNull(),
  capabilitiesJson: text('capabilities_json').notNull().default('[]'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastSeenAt: text('last_seen_at').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, table => [index('idx_execution_hosts_context').on(table.executionContextId)]);

/** The project owner grants access; the host separately declares local availability. */
export const hostWorkspaces = sqliteTable('host_workspaces', {
  id: text('id').primaryKey(),
  hostId: text('host_id').notNull(),
  projectId: text('project_id').notNull(),
  workspaceRef: text('workspace_ref').notNull(),
  workingPath: text('working_path'),
  accessGranted: integer('access_granted', { mode: 'boolean' }).notNull().default(true),
  available: integer('available', { mode: 'boolean' }).notNull().default(false),
  verifiedAt: text('verified_at'),
  updatedAt: text('updated_at').notNull(),
}, table => [uniqueIndex('idx_host_workspaces_host_project').on(table.hostId, table.projectId)]);
