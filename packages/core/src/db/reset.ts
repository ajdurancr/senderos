import { createClient, type Client } from '@libsql/client';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync, constants, copyFileSync, fsyncSync, lstatSync, fstatSync, fchmodSync,
  mkdtempSync, openSync, readFileSync, readSync, renameSync, rmSync, linkSync,
  unlinkSync, writeFileSync, realpathSync, type Stats,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { seedBuiltInAgents } from '../bootstrap/seed-agents';
import { seedBuiltInSenderos } from '../bootstrap/seed-senderos';
import { registerExecutionContext } from '../commands/execution-contexts/register';
import { configPathForHome, ensureWithinHome } from '../shared/config';
import type { SenderosConfig } from '../shared/types';
import { assertNoDatabaseReset, databaseResetLockPath, withDatabaseConnection } from './client';
import { migrateRuntimeDb, runtimeMigrationsFolder } from './migrate';

export type LocalDatabaseResetPreview = {
  home: string;
  configPath: string;
  databasePath: string;
  databaseUrl: string;
  urlEnv: string;
  executionContextId: string;
  fingerprint: string;
  targetFingerprint: string;
  warnings: string[];
};

function statIfPresent(path: string) {
  try { return lstatSync(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function identity(stat: Stats) { return [stat.dev, stat.ino, stat.nlink, stat.size, stat.mtimeMs, stat.ctimeMs]; }

function regularFile(path: string) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
    throw new Error(`Reset requires a regular, unlinked file: ${path}`);
  return stat;
}

function inspectAncestors(path: string) {
  for (let current = dirname(path); ; current = dirname(current)) {
    const stat = lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error(`Reset refuses symlink or non-directory path components: ${current}`);
    if (dirname(current) === current) break;
  }
}

function within(parent: string, child: string) {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function localPath(url: string) {
  // A narrow grammar avoids libSQL/URL-parser disagreements, URI options and credentials.
  if (!/^file:\/(?!\/)/.test(url) && !/^file:\/\/\/(?!\/)/.test(url))
    throw new Error('Reset supports only an explicit absolute local SQLite file URL. Remote, relative and in-memory databases are refused.');
  if (/[\x00-\x1f\x7f%?#\\]/.test(url))
    throw new Error('Reset refuses ambiguous file URLs, percent escapes, queries and fragments.');
  const path = url.startsWith('file:///') ? url.slice(7) : url.slice(5);
  if (!isAbsolute(path) || resolve(path) !== path)
    throw new Error('Reset requires a canonical absolute database path without dot segments or duplicate separators.');
  return path;
}

/** Filesystem-only inspection: does not open SQLite, create sidecars, or change config. */
function inspectLocalDatabaseReset(home: string, ownLock = false): LocalDatabaseResetPreview {
  const resolvedHome = resolve(home);
  const configPath = configPathForHome(resolvedHome);
  inspectAncestors(configPath);
  const configStat = regularFile(configPath);
  const configBytes = readFileSync(configPath);
  const config = JSON.parse(configBytes.toString()) as SenderosConfig;
  if (!config.database?.urlEnv || !config.executionContextId || typeof config.guardrails?.restrictToHome !== 'boolean')
    throw new Error('Reset requires an initialized Senderos configuration with an execution context and guardrails.');
  const url = process.env[config.database.urlEnv];
  if (!url) throw new Error(`Missing env:${config.database.urlEnv}`);
  const databasePath = localPath(url);
  inspectAncestors(databasePath);
  if (config.guardrails.restrictToHome) ensureWithinHome(resolvedHome, databasePath);
  const protectedRoots = [config.artifactRoot, config.logRoot, config.cacheRoot];
  if (protectedRoots.some(root => typeof root !== 'string' || !isAbsolute(root)))
    throw new Error('Reset requires absolute artifact, log and cache paths.');
  if (databasePath === configPath || basename(databasePath) === 'config.json' || /^\.env(?:\.|$)/.test(basename(databasePath)) || protectedRoots.some(root => within(resolve(root), databasePath) || (statIfPresent(root) && within(realpathSync(root), databasePath))))
    throw new Error(`Reset refuses a configuration, environment, artifact, log or cache path: ${databasePath}`);
  if (!ownLock) assertNoDatabaseReset(databasePath);
  const databaseStat = regularFile(databasePath);
  const fd = openSync(databasePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  const header = Buffer.alloc(100);
  try { readSync(fd, header, 0, header.length, 0); }
  finally { closeSync(fd); }
  if (header.subarray(0, 16).toString() !== 'SQLite format 3\0')
    throw new Error(`Reset target is not a SQLite database: ${databasePath}`);
  const sidecars = ['-wal', '-shm', '-journal'].map(suffix => {
    const path = `${databasePath}${suffix}`;
    return statIfPresent(path) ? [suffix, identity(regularFile(path))] : [suffix, null];
  });
  const targetFingerprint = createHash('sha256').update(configBytes).update(JSON.stringify({ home: resolvedHome, config: identity(configStat), url, database: [databaseStat.dev, databaseStat.ino] })).digest('hex');
  const fingerprint = createHash('sha256').update(configBytes).update(JSON.stringify({
    home: resolvedHome, config: identity(configStat), url, database: identity(databaseStat), header: header.toString('hex'), sidecars,
  })).digest('hex');
  return {
    home: resolvedHome, configPath, databasePath, databaseUrl: `file:${databasePath}`,
    urlEnv: config.database.urlEnv, executionContextId: config.executionContextId, fingerprint, targetFingerprint,
    warnings: [
      'This resets the entire database, including every execution context and custom definition.',
      'Stop all Senderos clients, hosts and Studio first. Existing open clients cannot be proven stopped.',
      'The original database will be retained in a private backup; config, environment files, artifacts, logs and caches are preserved.',
    ],
  };
}

export function previewLocalDatabaseReset(home: string): LocalDatabaseResetPreview {
  return inspectLocalDatabaseReset(home);
}

async function inspectDatabase(client: Client, contextId: string) {
  const integrity = await client.execute('PRAGMA integrity_check');
  if (integrity.rows.length !== 1 || integrity.rows[0]![0] !== 'ok')
    throw new Error('Reset refuses a corrupt SQLite database.');
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  if (!tables.rows.some(row => row.name === '__drizzle_migrations'))
    throw new Error('Reset refuses an unrelated, incomplete or unsupported Senderos schema.');
  const recorded = await client.execute('SELECT hash, created_at FROM __drizzle_migrations ORDER BY id');
  const bundled = readMigrationFiles({ migrationsFolder: runtimeMigrationsFolder() });
  if (!recorded.rows.length) throw new Error('Reset requires recorded Senderos migrations.');
  if (recorded.rows.length > bundled.length || recorded.rows.some((row, i) => row.hash !== bundled[i]!.hash || Number(row.created_at) !== bundled[i]!.folderMillis))
    throw new Error('Reset refuses unknown or noncontiguous Senderos migration history.');
  if (recorded.rows.length < 3)
    throw new Error('Reset cannot preserve an execution context from this pre-context Senderos schema.');
  // Reconstruct precisely the recorded bundled migration prefix in memory. This
  // recognizes supported historic databases without ever migrating the original.
  const reference = createClient({ url: 'file::memory:' });
  let hasClaims = false;
  let hasRecovery = false;
  try {
    for (const migration of bundled.slice(0, recorded.rows.length))
      await reference.executeMultiple(migration.sql.join('\n'));
    const expected = await reference.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    if (tables.rows.length !== expected.rows.length + 1)
      throw new Error('Reset refuses an unrelated, incomplete or unsupported Senderos schema.');
    for (const table of expected.rows) {
      const name = String(table.name);
      const required = await reference.execute(`PRAGMA table_info("${name}")`);
      const actual = await client.execute(`PRAGMA table_info("${name}")`);
      const shape = (rows: typeof required.rows) => rows.map(row => [row.name, row.type, row.notnull, row.dflt_value, row.pk]);
      if (JSON.stringify(shape(actual.rows)) !== JSON.stringify(shape(required.rows)))
        throw new Error('Reset refuses an unrelated, incomplete or unsupported Senderos schema.');
      if (name === 'attempt_claims') {
        hasClaims = true;
        hasRecovery = required.rows.some(row => row.name === 'recovery_outcome');
      }
    }
  } finally { reference.close(); }
  const contexts = await client.execute({ sql: 'SELECT id, name FROM execution_contexts WHERE id = ?', args: [contextId] });
  const context = contexts.rows[0];
  if (!context || typeof context.name !== 'string' || !context.name.trim())
    throw new Error('Configured execution context is missing from the existing database.');
  for (const table of ['runs', 'run_attempts']) {
    const active = await client.execute(`SELECT count(*) AS count FROM ${table} WHERE status NOT IN ('succeeded', 'failed', 'canceled')`);
    if (Number(active.rows[0]!.count)) throw new Error(`Reset refused: active ${table} exist across execution contexts. Stop or resolve them first.`);
  }
  if (hasClaims) {
    const leases = await client.execute(`SELECT count(*) AS count FROM attempt_claims c LEFT JOIN run_attempts a ON a.id = c.attempt_id
      WHERE (c.owner_id IS NOT NULL OR c.token IS NOT NULL OR c.lease_expires_at IS NOT NULL)
      AND (a.id IS NULL OR a.status NOT IN ('succeeded', 'failed', 'canceled')${hasRecovery ? " OR (c.recovery_outcome IN ('active', 'unknown') AND NOT COALESCE(julianday(a.finished_at) >= julianday(c.recovery_observed_at) AND (a.status <> 'canceled' OR julianday(c.acknowledged_at) >= julianday(c.recovery_observed_at)), 0))" : ''})`);
    if (Number(leases.rows[0]!.count)) throw new Error('Reset refused: unresolved attempt leases exist. Expiration alone does not prove a process stopped.');
  }
  return { id: contextId, name: context.name };
}

function assertNoSidecars(path: string) {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    if (statIfPresent(`${path}${suffix}`))
      throw new Error(`Reset refuses remaining SQLite sidecar: ${path}${suffix}. Stop all database clients.`);
  }
}

function assertSameFile(path: string, expected: Stats) {
  const actual = regularFile(path);
  if (actual.dev !== expected.dev || actual.ino !== expected.ino)
    throw new Error(`Reset file identity changed during preparation: ${path}`);
}

function secureFile(path: string, mode: number, expected: Stats) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const actual = fstatSync(fd);
    if (!actual.isFile() || actual.nlink !== 1 || actual.dev !== expected.dev || actual.ino !== expected.ino)
      throw new Error(`Reset file identity changed during preparation: ${path}`);
    fchmodSync(fd, mode);
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

function syncFile(path: string) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

/** Requires the exact inspected preview. No interactive UI and no process-global env changes. */
export async function resetLocalDatabase(home: string, expectedPreview: LocalDatabaseResetPreview) {
  const preview = previewLocalDatabaseReset(home);
  if (preview.fingerprint !== expectedPreview.fingerprint || preview.databasePath !== expectedPreview.databasePath || preview.home !== expectedPreview.home)
    throw new Error('Reset target or configuration changed since confirmation. Inspect and confirm again.');
  const originalIdentity = regularFile(preview.databasePath);
  const lockPath = databaseResetLockPath(preview.databasePath);
  const lockFd = openSync(lockPath, 'wx', 0o600);
  const lockIdentity = lstatSync(lockPath);
  let lockFdOpen = true;
  let client: Client | undefined;
  let transaction = false;
  let staging: string | undefined;
  let stagingIdentity: Stats | undefined;
  let backupPath: string | undefined;
  let replaced = false;
  let failure: unknown;
  let result: { home: string; databasePath: string; backupPath: string; executionContextId: string; executionContextName: string } | undefined;
  try {
    writeFileSync(lockFd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    closeSync(lockFd);
    lockFdOpen = false;
    if (inspectLocalDatabaseReset(home, true).fingerprint !== preview.fingerprint)
      throw new Error('Reset target or configuration changed while acquiring the reset lock.');
    // Other cooperative opens are fenced. Existing non-cooperative writers must also
    // release SQLite's locks; never delete WAL/SHM files to manufacture exclusivity.
    client = createClient({ url: preview.databaseUrl });
    await client.execute('PRAGMA trusted_schema=OFF');
    await inspectDatabase(client, preview.executionContextId);
    const mode = await client.execute('PRAGMA journal_mode=DELETE');
    if (mode.rows[0]?.[0] !== 'delete') throw new Error('Cannot safely checkpoint WAL and obtain exclusive SQLite access. Stop all database clients.');
    await client.execute('PRAGMA locking_mode=EXCLUSIVE');
    await client.execute('BEGIN EXCLUSIVE');
    transaction = true;
    if ((await client.execute('PRAGMA journal_mode')).rows[0]?.[0] !== 'delete')
      throw new Error('SQLite journal mode changed before the exclusive reset fence. Stop all database clients.');
    const context = await inspectDatabase(client, preview.executionContextId);
    assertNoSidecars(preview.databasePath);
    staging = mkdtempSync(join(dirname(preview.databasePath), `.${basename(preview.databasePath)}.reset-`));
    stagingIdentity = lstatSync(staging);
    const freshPath = join(staging, 'fresh.db');
    await withDatabaseConnection({ url: `file:${freshPath}` }, async () => {
      await migrateRuntimeDb(preview.home);
      await registerExecutionContext({ home: preview.home, ...context });
      await seedBuiltInAgents(preview.home);
      await seedBuiltInSenderos(preview.home);
    });
    const freshIdentity = regularFile(freshPath);
    const fresh = createClient({ url: `file:${freshPath}` });
    try {
      await fresh.execute('PRAGMA journal_mode=DELETE');
      await inspectDatabase(fresh, context.id);
    } finally { fresh.close(); }
    assertSameFile(freshPath, freshIdentity);
    assertNoSidecars(freshPath);
    // Recheck the target/config after all asynchronous preparation. Own SQLite mode
    // changes may alter file timestamps, so compare stable identity here instead.
    if (inspectLocalDatabaseReset(home, true).targetFingerprint !== preview.targetFingerprint)
      throw new Error('Reset target or configuration changed during preparation. Inspect and confirm again.');
    assertNoSidecars(preview.databasePath);
    inspectAncestors(freshPath);
    if (lstatSync(staging).ino !== stagingIdentity.ino) throw new Error('Reset staging directory changed during preparation.');
    assertSameFile(freshPath, freshIdentity);
    secureFile(freshPath, originalIdentity.mode & 0o777, freshIdentity);
    const stagedBackup = join(staging, 'original.db');
    copyFileSync(preview.databasePath, stagedBackup, constants.COPYFILE_EXCL);
    const backupIdentity = regularFile(stagedBackup);
    secureFile(stagedBackup, 0o600, backupIdentity);
    const retainedBackup = `${preview.databasePath}.backup-${randomUUID()}`;
    // The backup is made private inside a 0700 directory before being exposed.
    assertSameFile(stagedBackup, backupIdentity);
    linkSync(stagedBackup, retainedBackup);
    backupPath = retainedBackup;
    syncFile(dirname(preview.databasePath));
    assertSameFile(freshPath, freshIdentity);
    renameSync(freshPath, preview.databasePath);
    replaced = true;
    syncFile(dirname(preview.databasePath));
    result = { home: preview.home, databasePath: preview.databasePath, backupPath, executionContextId: context.id, executionContextName: context.name };
  } catch (error) { failure = error; }
  const cleanupErrors: string[] = [];
  try { if (lockFdOpen) closeSync(lockFd); }
  catch (error) { cleanupErrors.push((error as Error).message); }
  try { if (transaction) await client!.execute('ROLLBACK'); }
  catch (error) { cleanupErrors.push((error as Error).message); }
  try { client?.close(); }
  catch (error) { cleanupErrors.push((error as Error).message); }
  try {
    if (staging) {
      const stat = lstatSync(staging);
      if (stat.isSymbolicLink() || stat.dev !== stagingIdentity!.dev || stat.ino !== stagingIdentity!.ino)
        throw new Error(`Reset staging directory changed; inspect it manually: ${staging}`);
      rmSync(staging, { recursive: true });
    }
  }
  catch (error) { cleanupErrors.push((error as Error).message); }
  // A failed close/rollback leaves the lock as a visible recovery marker.
  if (!cleanupErrors.length) {
    try {
      const lock = statIfPresent(lockPath);
      if (lock?.dev === lockIdentity.dev && lock.ino === lockIdentity.ino) unlinkSync(lockPath);
      else cleanupErrors.push('Reset lock changed ownership; it was not removed');
    } catch (error) { cleanupErrors.push((error as Error).message); }
  }
  if (failure || cleanupErrors.length) {
    const detail = [failure ? (failure as Error).message : '', ...cleanupErrors].filter(Boolean).join('; ');
    throw new Error(`Database reset ${replaced ? 'installed the fresh database but cleanup did not finish' : 'was not completed'}: ${detail}. Target: ${preview.databasePath}${backupPath ? `. Original backup: ${backupPath}` : ''}${cleanupErrors.length ? `. Inspect recovery lock: ${lockPath}` : ''}`, { cause: failure });
  }
  return result!;
}
