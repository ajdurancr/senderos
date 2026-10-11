import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { initHome } from '../test-support/runtime';
import { openRuntimeDb } from './client';
import { previewLocalDatabaseReset, resetLocalDatabase } from './reset';

describe('safe local database reset', () => {
  test('rebuilds through production migrations and seeds while preserving config, files and context name', async () => {
    const home = await initHome();
    const db = openRuntimeDb(home);
    await db.$client.execute("UPDATE execution_contexts SET name = 'My context'");
    await db.$client.execute("UPDATE agents SET name = 'Customized old agent'");
    db.$client.close();
    const config = readFileSync(join(home, 'config.json'));
    writeFileSync(join(home, '.env'), 'do not touch\n');
    writeFileSync(join(home, 'artifacts', 'keep.txt'), 'keep');
    const before = readdirSync(home).sort();
    const preview = previewLocalDatabaseReset(home);
    expect(readdirSync(home).sort()).toEqual(before);
    const original = readFileSync(preview.databasePath);
    const result = await resetLocalDatabase(home, JSON.parse(JSON.stringify(preview)));
    expect(result.executionContextName).toBe('My context');
    expect(readFileSync(result.backupPath)).toEqual(original);
    expect(readFileSync(join(home, 'config.json'))).toEqual(config);
    expect(readFileSync(join(home, '.env'), 'utf8')).toBe('do not touch\n');
    expect(readFileSync(join(home, 'artifacts', 'keep.txt'), 'utf8')).toBe('keep');
    const fresh = openRuntimeDb(home);
    expect((await fresh.$client.execute('SELECT count(*) AS count FROM agents')).rows[0]!.count).toBeGreaterThan(0);
    expect((await fresh.$client.execute("SELECT count(*) AS count FROM agents WHERE name = 'Customized old agent'")).rows[0]!.count).toBe(0);
    expect((await fresh.$client.execute('SELECT count(*) AS count FROM senderos')).rows[0]!.count).toBeGreaterThan(0);
    expect((await fresh.$client.execute('SELECT name FROM execution_contexts')).rows.map(r => r.name)).toEqual(['My context']);
    fresh.$client.close();
  });
});

import { afterEach, mock, spyOn } from 'bun:test';
import * as fs from 'node:fs';
import * as libsql from '@libsql/client';
import { defaultConfigForHome, initializeRuntime, loadConfig } from '../shared/config';
import { tempHome } from '../test-support/runtime';
import { atomic, assertNoDatabaseReset, databaseResetLockPath, withDatabaseConnection } from './client';

afterEach(() => mock.restore());

async function sql(home: string, statement: string) {
  const db = openRuntimeDb(home);
  try { return await db.$client.execute(statement); } finally { db.$client.close(); }
}

function changeConfig(home: string, update: (config: ReturnType<typeof loadConfig>) => void) {
  const config = loadConfig(home);
  update(config);
  writeFileSync(join(home, 'config.json'), JSON.stringify(config));
}

async function refusesWithoutReplacement(home: string, pattern: string | RegExp) {
  const preview = previewLocalDatabaseReset(home);
  const bytes = readFileSync(preview.databasePath);
  await expect(resetLocalDatabase(home, preview)).rejects.toThrow(pattern);
  expect(readFileSync(preview.databasePath)).toEqual(bytes);
  expect(fs.existsSync(databaseResetLockPath(preview.databasePath))).toBe(false);
  expect(readdirSync(home).some(name => name.includes('.reset-'))).toBe(false);
}

describe('reset target inspection', () => {
  test.each([
    'https://example.test/private?authToken=secret', 'libsql://private.test', ':memory:', 'file::memory:',
    'file:relative.db', 'file://localhost/tmp/senderos.db', 'file:////tmp/a.db',
    'file:/tmp/x.db?mode=ro', 'file:/tmp/x.db#fragment', 'file:/tmp/%61.db',
    'file:/tmp/../a.db', 'file:/tmp//a.db', 'file:/tmp/a\\b.db', 'file:/tmp/a\nb.db',
  ])('refuses remote, ambiguous or noncanonical target %s without creating it', async url => {
    const home = await initHome();
    const before = readdirSync(home);
    process.env.SENDEROS_DATABASE_URL = url;
    expect(() => previewLocalDatabaseReset(home)).toThrow(/Reset/);
    expect(readdirSync(home)).toEqual(before);
  });

  test('uses the configured custom environment variable, accepts triple slash URL, and omits auth secrets', async () => {
    const home = await initHome();
    changeConfig(home, config => { config.database = { urlEnv: 'RESET_TEST_URL', authTokenEnv: 'RESET_TEST_TOKEN' }; });
    process.env.RESET_TEST_URL = `file://${home}/senderos.db`;
    process.env.RESET_TEST_TOKEN = 'never disclose this token';
    try {
      const preview = previewLocalDatabaseReset(home);
      expect(preview.urlEnv).toBe('RESET_TEST_URL');
      expect(preview.databasePath).toBe(join(home, 'senderos.db'));
      expect(JSON.stringify(preview)).not.toContain(process.env.RESET_TEST_TOKEN);
      const result = await resetLocalDatabase(home, preview);
      expect(result.databasePath).toBe(preview.databasePath);
      expect(process.env.RESET_TEST_URL).toBe(`file://${home}/senderos.db`);
    } finally { delete process.env.RESET_TEST_URL; delete process.env.RESET_TEST_TOKEN; }
  });

  test('requires initialized configuration and an effective URL', async () => {
    const home = await initHome();
    delete process.env.SENDEROS_DATABASE_URL;
    expect(() => previewLocalDatabaseReset(home)).toThrow('Missing env:SENDEROS_DATABASE_URL');
    changeConfig(home, config => { config.executionContextId = ''; });
    expect(() => previewLocalDatabaseReset(home)).toThrow('initialized Senderos configuration');
  });

  test('rejects missing, non-SQLite, directory and hardlinked database files', async () => {
    const home = await initHome();
    const original = join(home, 'senderos.db');
    for (const [name, create] of [
      ['missing.db', () => {}],
      ['text.db', () => writeFileSync(join(home, 'text.db'), 'not sqlite')],
      ['dir.db', () => fs.mkdirSync(join(home, 'dir.db'))],
      ['linked.db', () => fs.linkSync(original, join(home, 'linked.db'))],
    ] as const) {
      create();
      process.env.SENDEROS_DATABASE_URL = `file:${join(home, name)}`;
      expect(() => previewLocalDatabaseReset(home)).toThrow();
    }
  });

  test('rejects symlinks at the file, parent directory and config path', async () => {
    const home = await initHome();
    fs.symlinkSync(join(home, 'senderos.db'), join(home, 'alias.db'));
    process.env.SENDEROS_DATABASE_URL = `file:${join(home, 'alias.db')}`;
    expect(() => previewLocalDatabaseReset(home)).toThrow('regular, unlinked file');
    fs.symlinkSync(home, join(home, 'alias-dir'));
    process.env.SENDEROS_DATABASE_URL = `file:${join(home, 'alias-dir', 'senderos.db')}`;
    expect(() => previewLocalDatabaseReset(home)).toThrow('symlink or non-directory');
    process.env.SENDEROS_DATABASE_URL = `file:${join(home, 'senderos.db')}`;
    fs.renameSync(join(home, 'config.json'), join(home, 'original-config.json'));
    fs.symlinkSync(join(home, 'original-config.json'), join(home, 'config.json'));
    expect(() => previewLocalDatabaseReset(home)).toThrow('regular, unlinked file');
  });

  test('enforces home guardrail but permits an explicitly unrestricted local target', async () => {
    const home = await initHome();
    const outside = tempHome();
    fs.copyFileSync(join(home, 'senderos.db'), join(outside, 'external.db'));
    process.env.SENDEROS_DATABASE_URL = `file:${join(outside, 'external.db')}`;
    expect(() => previewLocalDatabaseReset(home)).toThrow('outside Senderos home');
    changeConfig(home, config => { config.guardrails.restrictToHome = false; });
    const preview = previewLocalDatabaseReset(home);
    expect((await resetLocalDatabase(home, preview)).databasePath).toBe(join(outside, 'external.db'));
  });

  test.each(['.env', '.env.local', 'config.json', 'artifacts/data.db', 'logs/data.db', 'cache/data.db'])('never accepts protected %s paths', async path => {
    const home = await initHome();
    process.env.SENDEROS_DATABASE_URL = `file:${join(home, path)}`;
    expect(() => previewLocalDatabaseReset(home)).toThrow('configuration, environment, artifact, log or cache');
  });

  test('rejects a protected root alias and relative protected root config', async () => {
    const home = await initHome();
    fs.mkdirSync(join(home, 'protected-target'));
    fs.copyFileSync(join(home, 'senderos.db'), join(home, 'protected-target', 'data.db'));
    fs.symlinkSync(join(home, 'protected-target'), join(home, 'artifact-alias'));
    changeConfig(home, config => { config.artifactRoot = join(home, 'artifact-alias'); });
    process.env.SENDEROS_DATABASE_URL = `file:${join(home, 'protected-target', 'data.db')}`;
    expect(() => previewLocalDatabaseReset(home)).toThrow('artifact, log or cache');
    changeConfig(home, config => { config.artifactRoot = 'relative'; });
    expect(() => previewLocalDatabaseReset(home)).toThrow('absolute artifact');
  });

  test('rejects symlinked and hardlinked sidecars without removing them', async () => {
    const home = await initHome();
    const sidecar = join(home, 'senderos.db-wal');
    fs.symlinkSync(join(home, 'senderos.db'), sidecar);
    expect(() => previewLocalDatabaseReset(home)).toThrow('regular, unlinked file');
    fs.unlinkSync(sidecar);
    fs.linkSync(join(home, 'config.json'), sidecar);
    expect(() => previewLocalDatabaseReset(home)).toThrow('regular, unlinked file');
    expect(fs.existsSync(sidecar)).toBe(true);
  });

  test('preview is truly read-only even for WAL databases', async () => {
    const home = await initHome();
    const db = openRuntimeDb(home);
    await db.$client.execute('PRAGMA journal_mode=WAL');
    await db.$client.execute("UPDATE execution_contexts SET name='WAL context'");
    const snapshot = () => readdirSync(home).sort().map(name => {
      const path = join(home, name), stat = fs.lstatSync(path);
      return { name, size: stat.size, mtime: stat.mtimeMs, bytes: stat.isFile() ? readFileSync(path).toString('hex') : '' };
    });
    const before = snapshot();
    expect(previewLocalDatabaseReset(home).databasePath).toBe(join(home, 'senderos.db'));
    expect(snapshot()).toEqual(before);
    db.$client.close();
  });
});

describe('database recognition and activity fences', () => {
  test.each([
    ['unrelated tables', 'CREATE TABLE unrelated_secret (value text)', 'unsupported Senderos schema'],
    ['missing columns', 'ALTER TABLE runs RENAME COLUMN status TO old_status', 'unsupported Senderos schema'],
    ['missing migration rows', 'DELETE FROM __drizzle_migrations', 'recorded Senderos migrations'],
    ['missing configured context', 'DELETE FROM execution_contexts', 'execution context is missing'],
    ['blank context name', "UPDATE execution_contexts SET name='  '", 'execution context is missing'],
    ['active other-context runs', "INSERT INTO runs (id,goal_id,status,created_at,updated_at) VALUES ('other-run','other-context-goal','executing','now','now')", 'active runs'],
    ['queued other-context attempts', "INSERT INTO run_attempts (id,run_id,attempt_number,agent_id,status,execution_objective,harness,created_at,updated_at) VALUES ('other-attempt','other-run',1,'agent','queued','work','codex','now','now')", 'active run_attempts'],
    ['expired orphan leases', "INSERT INTO attempt_claims (attempt_id,owner_id,token,lease_expires_at) VALUES ('missing-attempt','host','lease','2000-01-01')", 'unresolved attempt leases'],
  ])('refuses %s without replacing or leaving a lock', async (_, statement, message) => {
    const home = await initHome();
    await sql(home, statement);
    await refusesWithoutReplacement(home, message);
  });

  test('terminal historical attempts and resolved leases can be reset', async () => {
    const home = await initHome();
    await sql(home, "INSERT INTO runs (id,goal_id,status,created_at,updated_at) VALUES ('old-run','old-goal','succeeded','now','now')");
    await sql(home, "INSERT INTO run_attempts (id,run_id,attempt_number,agent_id,status,execution_objective,harness,created_at,updated_at) VALUES ('old-attempt','old-run',1,'agent','succeeded','work','codex','now','now')");
    await sql(home, "INSERT INTO attempt_claims (attempt_id,owner_id,token,lease_expires_at,recovery_outcome) VALUES ('old-attempt','host','lease','2000-01-01','finished')");
    await resetLocalDatabase(home, previewLocalDatabaseReset(home));
    expect((await sql(home, 'SELECT count(*) AS count FROM runs')).rows[0]!.count).toBe(0);
  });

  test('corrupt SQLite files are refused without replacement', async () => {
    const home = await initHome();
    const bytes = readFileSync(join(home, 'senderos.db'));
    bytes.fill(255, 100, 250);
    writeFileSync(join(home, 'senderos.db'), bytes);
    await refusesWithoutReplacement(home, /malformed|corrupt/);
  });

  test('refuses a live SQL writer without replacing its database', async () => {
    const home = await initHome();
    const client = openRuntimeDb(home).$client;
    await client.execute('BEGIN IMMEDIATE');
    try { await refusesWithoutReplacement(home, /locked|busy/); }
    finally { await client.execute('ROLLBACK'); client.close(); }
  });

  test('WAL is checkpointed and backed up only after safe exclusive access', async () => {
    const home = tempHome();
    process.env.SENDEROS_DATABASE_URL = `file:${join(home, 'senderos.db')}`;
    // Native libSQL WAL locks can outlive client.close() until the writer process
    // exits. This models the documented stop-all-clients prerequisite honestly.
    const child = Bun.spawnSync([process.execPath, '-e', `
      import { initializeRuntime } from ${JSON.stringify(join(import.meta.dir, '../shared/config.ts'))};
      import { openRuntimeDb } from ${JSON.stringify(join(import.meta.dir, 'client.ts'))};
      await initializeRuntime(${JSON.stringify(home)});
      const db = openRuntimeDb(${JSON.stringify(home)});
      await db.$client.execute('PRAGMA journal_mode=WAL');
      await db.$client.execute("UPDATE execution_contexts SET name='WAL saved context'");
      db.$client.close();
    `], { stdout: 'pipe', stderr: 'pipe' });
    expect(child.exitCode).toBe(0);
    const result = await resetLocalDatabase(home, previewLocalDatabaseReset(home));
    expect(result.executionContextName).toBe('WAL saved context');
    expect(fs.existsSync(`${result.databasePath}-wal`)).toBe(false);
    expect(fs.existsSync(`${result.databasePath}-shm`)).toBe(false);
    const backup = libsql.createClient({ url: `file:${result.backupPath}` });
    expect((await backup.execute('SELECT name FROM execution_contexts')).rows[0]!.name).toBe('WAL saved context');
    backup.close();
  });
});

describe('confirmation races and cooperative reset locks', () => {
  test.each(['config', 'database', 'URL', 'sidecar'] as const)('refuses %s changes since inspection', async change => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home);
    if (change === 'config') changeConfig(home, config => { config.defaultHarness = 'unknown'; });
    if (change === 'database') await sql(home, "UPDATE execution_contexts SET name='changed'");
    if (change === 'URL') process.env.SENDEROS_DATABASE_URL = `file://${home}/senderos.db`;
    if (change === 'sidecar') writeFileSync(join(home, 'senderos.db-journal'), 'stale journal');
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow('changed since confirmation');
  });

  test('refuses existing locks and never silently clears them', async () => {
    const home = await initHome();
    const path = join(home, 'senderos.db');
    writeFileSync(databaseResetLockPath(path), 'old lock');
    expect(() => previewLocalDatabaseReset(home)).toThrow('reset lock exists');
    expect(() => openRuntimeDb(home)).toThrow('reset lock exists');
    expect(() => openRuntimeDb()).toThrow('reset lock exists');
    expect(readFileSync(databaseResetLockPath(path), 'utf8')).toBe('old lock');
  });

  test('parallel resets fail closed and new ordinary DB opens see the cooperative fence', async () => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home);
    const resetting = resetLocalDatabase(home, preview);
    expect(() => openRuntimeDb(home)).toThrow('reset lock exists');
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow('reset lock exists');
    await resetting;
    expect((await sql(home, 'SELECT 1 AS value')).rows[0]!.value).toBe(1);
  });

  test('scoped connection overrides isolate concurrent async work and restore on error', async () => {
    const home = await initHome();
    const first = `file:${join(home, 'first.db')}`, second = `file:${join(home, 'second.db')}`;
    const original = process.env.SENDEROS_DATABASE_URL;
    const [one, two] = await Promise.all([first, second].map((url, i) => withDatabaseConnection({ url }, async () => {
      await Promise.resolve();
      await openRuntimeDb(home).$client.execute(`CREATE TABLE scoped_${i} (value text)`);
      return (await openRuntimeDb(home).$client.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map(row => row.name);
    })));
    expect(one).toEqual(['scoped_0']); expect(two).toEqual(['scoped_1']);
    await expect(withDatabaseConnection({ url: first }, async () => { throw new Error('scope failed'); })).rejects.toThrow('scope failed');
    expect(process.env.SENDEROS_DATABASE_URL).toBe(original);
    await atomic(home, async () => {
      await expect(withDatabaseConnection({ url: first }, async () => {})).rejects.toThrow('inside a transaction');
    });
    expect((await sql(home, 'SELECT count(*) AS count FROM agents')).rows[0]!.count).toBeGreaterThan(0);
  });
});

describe('reset preparation and failure recovery', () => {
  test.each(['config bytes', 'config symlink', 'effective URL', 'database inode'])('revalidates %s immediately before replacement', async change => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home);
    const originalBytes = readFileSync(preview.databasePath);
    const mkdir = fs.mkdtempSync;
    spyOn(fs, 'mkdtempSync').mockImplementation((prefix, options) => {
      const directory = mkdir(prefix, options as any);
      if (change === 'config bytes') changeConfig(home, config => { config.defaultHarness = 'unknown'; });
      if (change === 'config symlink') {
        fs.renameSync(preview.configPath, join(home, 'saved-config.json'));
        fs.symlinkSync(join(home, 'saved-config.json'), preview.configPath);
      }
      if (change === 'effective URL') process.env.SENDEROS_DATABASE_URL = `file://${home}/senderos.db`;
      if (change === 'database inode') {
        fs.renameSync(preview.databasePath, `${preview.databasePath}.moved`);
        writeFileSync(preview.databasePath, originalBytes);
      }
      return directory as any;
    });
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow(/changed during preparation|regular, unlinked/);
    expect(readFileSync(preview.databasePath)).toEqual(originalBytes);
    expect(fs.existsSync(databaseResetLockPath(preview.databasePath))).toBe(false);
    expect(readdirSync(home).some(name => name.includes('.backup-'))).toBe(false);
  });

  test('a failed fresh migration leaves original bytes intact and removes disposable staging', async () => {
    const home = await initHome();
    const make = libsql.createClient;
    spyOn(libsql, 'createClient').mockImplementation(options => {
      if (options.url.endsWith('/fresh.db')) throw new Error('injected migration connection failure');
      return make(options);
    });
    await refusesWithoutReplacement(home, 'injected migration connection failure');
  });

  test('failed atomic replacement preserves original and a private retained backup', async () => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home);
    const before = readFileSync(preview.databasePath);
    const rename = fs.renameSync;
    spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (to === preview.databasePath) throw new Error('injected replace failure');
      return rename(from, to);
    });
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow(/injected replace failure.*Original backup:/);
    expect(readFileSync(preview.databasePath)).toEqual(before);
    const backup = readdirSync(home).find(name => name.startsWith('senderos.db.backup-'))!;
    expect(backup).toBeDefined();
    expect(readFileSync(join(home, backup))).toEqual(before);
    expect(fs.statSync(join(home, backup)).mode & 0o777).toBe(0o600);
    expect(fs.statSync(join(home, backup)).nlink).toBe(1);
    expect(fs.existsSync(databaseResetLockPath(preview.databasePath))).toBe(false);
  });

  test('failed backup cannot replace or damage the original', async () => {
    const home = await initHome();
    spyOn(fs, 'copyFileSync').mockImplementation(() => { throw new Error('injected backup copy failure'); });
    await refusesWithoutReplacement(home, 'injected backup copy failure');
  });

  test('failed cleanup reports the installed database, retained backup, and recovery lock', async () => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home);
    const remove = fs.rmSync;
    spyOn(fs, 'rmSync').mockImplementation((path, options) => {
      if (String(path).includes('.reset-')) throw new Error('injected staging cleanup failure');
      return remove(path, options);
    });
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow(/installed the fresh database.*Original backup:.*Inspect recovery lock:/);
    expect(fs.existsSync(databaseResetLockPath(preview.databasePath))).toBe(true);
    expect(() => openRuntimeDb(home)).toThrow('reset lock exists');
  });

  test('does not remove a reset lock whose ownership changed', async () => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home);
    const lockPath = databaseResetLockPath(preview.databasePath);
    const rename = fs.renameSync;
    spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      const value = rename(from, to);
      if (to === preview.databasePath) {
        fs.renameSync(lockPath, `${lockPath}.old`);
        writeFileSync(lockPath, 'replacement owner');
      }
      return value;
    });
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow('Reset lock changed ownership');
    expect(readFileSync(lockPath, 'utf8')).toBe('replacement owner');
  });

  test('does not traverse or delete replaced staging directories during cleanup', async () => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home);
    const other = join(home, 'keep-directory'); fs.mkdirSync(other);
    writeFileSync(join(other, 'keep.txt'), 'keep');
    const make = libsql.createClient;
    spyOn(libsql, 'createClient').mockImplementation(options => {
      if (options.url.endsWith('/fresh.db')) {
        const directory = options.url.slice(5, -'/fresh.db'.length);
        fs.renameSync(directory, `${directory}-moved`);
        fs.symlinkSync(other, directory);
        throw new Error('staging replaced');
      }
      return make(options);
    });
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow('Reset staging directory changed; inspect it manually:');
    expect(readFileSync(join(other, 'keep.txt'), 'utf8')).toBe('keep');
    expect(fs.existsSync(databaseResetLockPath(preview.databasePath))).toBe(true);
  });
});

import { readMigrationFiles } from 'drizzle-orm/migrator';
import { runtimeMigrationsFolder } from './migrate';

async function legacyHome(count: number) {
  const home = tempHome();
  const config = defaultConfigForHome(home, 'codex', 'legacy-context');
  writeFileSync(join(home, 'config.json'), JSON.stringify(config));
  const url = `file:${join(home, 'senderos.db')}`;
  process.env.SENDEROS_DATABASE_URL = url;
  const client = libsql.createClient({ url });
  const migrations = readMigrationFiles({ migrationsFolder: runtimeMigrationsFolder() });
  try {
    await client.execute('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric)');
    for (const migration of migrations.slice(0, count)) {
      await client.executeMultiple(migration.sql.join('\n'));
      await client.execute({ sql: 'INSERT INTO __drizzle_migrations (hash,created_at) VALUES (?,?)', args: [migration.hash, migration.folderMillis] });
    }
    if (count >= 3) await client.execute("INSERT INTO execution_contexts (id,name,created_at,updated_at) VALUES ('legacy-context','Preserved legacy name','now','now')");
  } finally { client.close(); }
  return home;
}

describe('recognized legacy migration prefixes', () => {
  test.each([3, 4, 5])('resets known migration count %i without migrating or altering original backup', async count => {
    const home = await legacyHome(count);
    const preview = previewLocalDatabaseReset(home);
    const original = readFileSync(preview.databasePath);
    const config = readFileSync(preview.configPath);
    const result = await resetLocalDatabase(home, preview);
    expect(result.executionContextName).toBe('Preserved legacy name');
    expect(readFileSync(result.backupPath)).toEqual(original);
    expect(readFileSync(preview.configPath)).toEqual(config);
    expect((await sql(home, 'SELECT count(*) AS count FROM __drizzle_migrations')).rows[0]!.count).toBe(6);
    expect((await sql(home, 'SELECT count(*) AS count FROM execution_hosts')).rows[0]!.count).toBe(0);
    expect((await sql(home, 'SELECT count(*) AS count FROM senderos')).rows[0]!.count).toBeGreaterThan(0);
  });

  test('pre-context schemas fail with an explicit preservation limitation', async () => {
    const home = await legacyHome(2);
    await refusesWithoutReplacement(home, 'pre-context Senderos schema');
  });

  test.each([
    ['unknown hash', "UPDATE __drizzle_migrations SET hash='unknown' WHERE id=1"],
    ['missing middle migration', 'DELETE FROM __drizzle_migrations WHERE id=2'],
    ['unrecorded schema change', 'ALTER TABLE runs ADD COLUMN unexpected text'],
  ])('refuses %s while recognizing legacy prefixes', async (_, change) => {
    const home = await legacyHome(4);
    await sql(home, change);
    await refusesWithoutReplacement(home, /migration history|unsupported Senderos schema/);
  });

  test('legacy active runs and orphaned expired leases still block reset', async () => {
    const home = await legacyHome(4);
    await sql(home, "INSERT INTO runs (id,goal_id,status,created_at,updated_at) VALUES ('old-run','other-context-goal','executing','now','now')");
    await refusesWithoutReplacement(home, 'active runs');
    await sql(home, "UPDATE runs SET status='succeeded'");
    await sql(home, "INSERT INTO attempt_claims (attempt_id,owner_id,lease_expires_at) VALUES ('orphan','host','2000-01-01')");
    await refusesWithoutReplacement(home, 'unresolved attempt leases');
  });
});

describe('all driver-local URL aliases respect the reset fence', () => {
  test.each(['uppercase', 'relative encoded', 'symlink file', 'symlink ancestor'])('guards %s aliases', async kind => {
    const home = await initHome();
    const path = join(home, 'senderos.db');
    const urls = {
      uppercase: `FILE:${path}`,
      'relative encoded': `file:${relative(process.cwd(), home)}/%73enderos.db`,
      'symlink file': `file:${join(home, 'alias.db')}`,
      'symlink ancestor': `file:${join(home, 'alias-dir', 'senderos.db')}`,
    };
    fs.symlinkSync(path, join(home, 'alias.db'));
    fs.symlinkSync(home, join(home, 'alias-dir'));
    writeFileSync(databaseResetLockPath(path), 'active reset');
    process.env.SENDEROS_DATABASE_URL = urls[kind as keyof typeof urls];
    expect(() => openRuntimeDb(home)).toThrow('reset lock exists');
  });

  test('only exact memory URLs bypass filesystem locks', async () => {
    const home = await initHome();
    const originalCwd = process.cwd();
    try {
      process.chdir(home);
      writeFileSync(databaseResetLockPath(join(home, ':memory:foo')), 'active reset');
      process.env.SENDEROS_DATABASE_URL = 'file::memory:foo';
      expect(() => openRuntimeDb(home)).toThrow('reset lock exists');
      process.env.SENDEROS_DATABASE_URL = 'file::memory:';
      const memory = openRuntimeDb(home); memory.$client.close();
      expect(fs.existsSync(join(home, ':memory:'))).toBe(false);
    } finally { process.chdir(originalCwd); }
  });
});

import { strictHostFixture } from '../test-support/host-runtime';
import { reconcileAttempt } from '../lifecycle/hosts';
import { cancelGoal, updateRunAttempt } from '../commands';

describe('resolved real host lifecycle and backup durability', () => {
  test.each(['canceled', 'failed'] as const)('terminal %s reporting supersedes an old unknown recovery observation', async status => {
    const { home, attemptId, goalId, hostApi, db } = await strictHostFixture();
    const claim = await hostApi.claim(); await hostApi.start(claim.token);
    await reconcileAttempt({ attemptId, ownerId: 'host-a', outcome: 'unknown', details: 'Registry temporarily unavailable', token: claim.token }, home);
    if (status === 'canceled') await cancelGoal(goalId, home);
    await updateRunAttempt(attemptId, { token: claim.token, status }, home);
    db.$client.close();
    const result = await resetLocalDatabase(home, previewLocalDatabaseReset(home));
    expect(result.backupPath).toBeDefined();
    expect((await sql(home, 'SELECT count(*) AS count FROM run_attempts')).rows[0]!.count).toBe(0);
  });

  test('a backup directory sync failure prevents atomic replacement', async () => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home), before = readFileSync(preview.databasePath);
    const sync = fs.fsyncSync;
    spyOn(fs, 'fsyncSync').mockImplementation(fd => {
      if (fs.fstatSync(fd).isDirectory()) throw new Error('injected directory sync failure');
      return sync(fd);
    });
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow(/was not completed.*directory sync failure.*Original backup:/);
    expect(readFileSync(preview.databasePath)).toEqual(before);
    expect(fs.existsSync(databaseResetLockPath(preview.databasePath))).toBe(false);
  });
});

describe('disposable file identity fences', () => {
  test.each(['symlink', 'hardlink', 'replacement'])('refuses a %s fresh-file swap without chmodding its target', async kind => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home);
    const original = readFileSync(preview.databasePath);
    const marker = join(home, 'private-marker');
    writeFileSync(marker, 'private', { mode: 0o600 });
    const make = libsql.createClient;
    spyOn(libsql, 'createClient').mockImplementation(options => {
      const client = make(options);
      if (options.url.endsWith('/fresh.db')) {
        const execute = client.execute.bind(client), close = client.close.bind(client);
        let validated = false;
        client.execute = ((...args: any[]) => {
          if (args[0] === 'PRAGMA integrity_check') validated = true;
          return (execute as any)(...args);
        }) as typeof client.execute;
        client.close = () => {
          close();
          if (!validated) return;
          const file = options.url.slice(5);
          fs.unlinkSync(file);
          if (kind === 'symlink') fs.symlinkSync(marker, file);
          if (kind === 'hardlink') fs.linkSync(marker, file);
          if (kind === 'replacement') writeFileSync(file, original);
        };
      }
      return client;
    });
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow(/regular, unlinked|file identity changed/);
    expect(fs.statSync(marker).mode & 0o777).toBe(0o600);
    expect(readFileSync(marker, 'utf8')).toBe('private');
    expect(readFileSync(preview.databasePath)).toEqual(original);
  });
});

describe('uncertain SQLite cleanup stays visibly fenced', () => {
  test('a rollback failure preserves both the preparation error and recovery lock', async () => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home), original = readFileSync(preview.databasePath);
    const make = libsql.createClient;
    spyOn(libsql, 'createClient').mockImplementation(options => {
      if (options.url.endsWith('/fresh.db')) throw new Error('preparation failed');
      const client = make(options);
      if (options.url === preview.databaseUrl) {
        const execute = client.execute.bind(client);
        client.execute = ((...args: any[]) => args[0] === 'ROLLBACK'
          ? Promise.reject(new Error('rollback failed')) : (execute as any)(...args)) as typeof client.execute;
      }
      return client;
    });
    await expect(resetLocalDatabase(home, preview)).rejects.toThrow(/preparation failed; rollback failed.*Inspect recovery lock:/);
    expect(readFileSync(preview.databasePath)).toEqual(original);
    expect(fs.existsSync(databaseResetLockPath(preview.databasePath))).toBe(true);
    expect(readdirSync(home).some(name => name.includes('.reset-'))).toBe(false);
  });

  test('a backup publication failure never advertises a nonexistent retained backup', async () => {
    const home = await initHome();
    const preview = previewLocalDatabaseReset(home), original = readFileSync(preview.databasePath);
    spyOn(fs, 'linkSync').mockImplementation(() => { throw new Error('backup publication failed'); });
    let message = '';
    try { await resetLocalDatabase(home, preview); } catch (error) { message = (error as Error).message; }
    expect(message).toContain('backup publication failed');
    expect(message).not.toContain('Original backup:');
    expect(readFileSync(preview.databasePath)).toEqual(original);
    expect(fs.existsSync(databaseResetLockPath(preview.databasePath))).toBe(false);
  });
});
