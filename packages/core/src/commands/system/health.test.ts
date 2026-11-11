import { expect, spyOn, test } from 'bun:test';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defaultConfigForHome } from '../../shared/config';
import { initHome, tempHome } from '../../test-support/runtime';
import { doctor } from './health';

for (const bytes of ['{"private-marker":', 'null', '[]', '{}']) test(`doctor reports damaged config without throwing or modifying it: ${bytes}`, async () => {
  const home = tempHome();
  const path = join(home, 'config.json');
  writeFileSync(path, bytes);
  const before = readdirSync(home);
  const result = await doctor(home);
  expect(result.ok).toBe(false);
  expect(result.issues.join(' ')).toContain('invalid config');
  expect(JSON.stringify(result)).not.toContain('private-marker');
  expect(readFileSync(path, 'utf8')).toBe(bytes);
  expect(readdirSync(home)).toEqual(before);
});
for (const [field, value] of [
  ['executionContextId', ''], ['database', null], ['guardrails', {}],
  ['artifactRoot', 'relative'], ['logRoot', 42], ['defaultHarness', ''],
  ['output', { format: 'other' }],
] as const) test(`doctor validates ${field} before opening a database`, async () => {
  const home = tempHome();
  writeFileSync(join(home, 'config.json'), JSON.stringify({ ...defaultConfigForHome(home, 'custom-harness'), [field]: value }));
  const result = await doctor(home);
  expect(result.ok).toBe(false);
  expect(result.issues.join(' ')).toContain(`invalid config: ${field}`);
  expect(readdirSync(home)).toEqual(['config.json']);
});
test('doctor rejects a file at a managed directory path and preserves database/config bytes', async () => {
  const home = await initHome();
  const config = readFileSync(join(home, 'config.json'));
  const database = readFileSync(join(home, 'senderos.db'));
  const path = join(home, 'logs');
  rmSync(path, { recursive: true }); writeFileSync(path, 'fixture file');
  const result = await doctor(home);
  expect(result.ok).toBe(false);
  expect(result.issues).toContain(`not a directory:${path}`);
  expect(readFileSync(path, 'utf8')).toBe('fixture file');
  expect(readFileSync(join(home, 'config.json'))).toEqual(config);
  expect(readFileSync(join(home, 'senderos.db'))).toEqual(database);
});
test('doctor accepts custom harnesses and optional auth configuration without certifying execution', async () => {
  const home = tempHome();
  const config = defaultConfigForHome(home, 'company-custom-harness');
  delete config.database.authTokenEnv;
  const { initializeRuntime } = await import('../../shared/config');
  await initializeRuntime(home, config);
  expect(await doctor(home)).toMatchObject({ ok: true, defaultHarness: 'company-custom-harness' });
  writeFileSync(join(home, 'config.json'), JSON.stringify({ ...config, database: { ...config.database, authTokenEnv: '' } }));
  expect((await doctor(home)).issues).toContain('invalid config: database');
});
test('doctor does not coerce a malformed output format into a valid string', async () => {
  const home = tempHome();
  writeFileSync(join(home, 'config.json'), JSON.stringify({ ...defaultConfigForHome(home, 'codex'), output: { format: ['json'] } }));
  expect((await doctor(home)).issues).toContain('invalid config: output');
});
test('doctor reports an unreadable config path without leaking raw configuration', async () => {
  const home = tempHome();
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(home, 'config.json'));
  expect(await doctor(home)).toEqual({ ok: false, issues: ['invalid config: cannot read or parse config.json'], warnings: [] });
});
test('doctor retains home guardrails and reports inaccessible directory ancestry', async () => {
  const home = await initHome();
  const configPath = join(home, 'config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  writeFileSync(join(home, 'file'), 'fixture');
  config.logRoot = join(home, 'file', 'nested');
  config.artifactRoot = tempHome();
  writeFileSync(configPath, JSON.stringify(config));
  const result = await doctor(home);
  expect(result.ok).toBe(false);
  expect(result.issues).toContain(`unreadable dir:${config.logRoot}`);
  expect(result.issues).toContain(`Guardrail violation: path outside Senderos home: ${config.artifactRoot}`);
});

test('doctor diagnoses a missing configured context without repairing identity or retained projects', async () => {
  const home = await initHome();
  const { loadConfig } = await import('../../shared/config');
  const { openRuntimeDb, healthcheckCurrentDb } = await import('../../db/client');
  const { createProject } = await import('../projects/create');
  const { listProjects } = await import('../projects/list');
  const { listExecutionContexts } = await import('../execution-contexts/list');
  const { registerExecutionContext } = await import('../execution-contexts/register');
  const config = loadConfig(home);
  const project = await createProject({ home, name: 'Retained project' });
  await registerExecutionContext({ home, id: 'unrelated-context', name: 'Unrelated context' });
  const db = openRuntimeDb(home);
  try {
    expect((await db.$client.execute({ sql: 'DELETE FROM execution_contexts WHERE id = ?', args: [config.executionContextId] })).rowsAffected).toBe(1);
    // Scope navigation cannot offer the missing identity, even though its project remains.
    expect((await listExecutionContexts(home)).map(context => context.id)).toEqual(['unrelated-context']);
    expect((await listProjects(home, config.executionContextId)).map(project => project.id)).toEqual([project.id]);
    const before = readFileSync(join(home, 'config.json'));
    const database = readFileSync(join(home, 'senderos.db'));
    const result = await doctor(home);
    expect(result.ok).toBe(false);
    expect(result.issues).toContain('missing execution context: configured ID is not registered in this database');
    expect(readFileSync(join(home, 'config.json'))).toEqual(before);
    expect(readFileSync(join(home, 'senderos.db'))).toEqual(database);
    expect((await listExecutionContexts(home)).map(context => context.id)).toEqual(['unrelated-context']);
    expect((await listProjects(home, config.executionContextId)).map(project => project.id)).toEqual([project.id]);
    // Global database availability has no home-specific identity prerequisite.
    expect((await healthcheckCurrentDb()).ok).toBe(true);
    await registerExecutionContext({ home, id: config.executionContextId, name: 'Restored identity' });
    expect((await doctor(home)).ok).toBe(true);
    expect((await listProjects(home, config.executionContextId)).map(project => project.id)).toEqual([project.id]);
  } finally { db.$client.close(); }
});

test('doctor preserves schema findings when context registration cannot be queried', async () => {
  const home = await initHome();
  const { openRuntimeDb } = await import('../../db/client');
  const db = openRuntimeDb(home);
  try {
    await db.$client.execute('DROP TABLE execution_contexts');
    const result = await doctor(home);
    expect(result.ok).toBe(false);
    expect(result.issues).toContain('missing table:execution_contexts');
    expect(result.issues).not.toContain('missing execution context: configured ID is not registered in this database');
  } finally { db.$client.close(); }
});

test('doctor retains missing context and unrelated schema findings together', async () => {
  const home = await initHome();
  const { openRuntimeDb } = await import('../../db/client');
  const db = openRuntimeDb(home);
  try {
    await db.$client.execute('DELETE FROM execution_contexts');
    await db.$client.execute('DROP TABLE run_attempts');
    const result = await doctor(home);
    expect(result.ok).toBe(false);
    expect(result.issues).toContain('missing table:run_attempts');
    expect(result.issues).toContain('missing execution context: configured ID is not registered in this database');
  } finally { db.$client.close(); }
});

test('a failed context probe preserves schema findings and omits driver credentials', async () => {
  const home = await initHome();
  const { openRuntimeDb } = await import('../../db/client');
  const libsql = await import('@libsql/client');
  const db = openRuntimeDb(home);
  await db.$client.execute('DROP TABLE run_attempts');
  const execute = db.$client.execute.bind(db.$client);
  const probe = spyOn(db.$client, 'execute').mockImplementation(async statement => {
    if (typeof statement !== 'string' && statement.sql.startsWith('SELECT id FROM execution_contexts'))
      throw new Error('synthetic-context-probe-credential');
    return execute(statement);
  });
  const create = spyOn(libsql, 'createClient').mockReturnValue(db.$client);
  try {
    const result = await doctor(home);
    expect(result.ok).toBe(false);
    expect(result.issues).toContain('missing table:run_attempts');
    expect(result.issues.join(' ')).toContain('Database health check failed');
    expect(JSON.stringify(result)).not.toContain('synthetic');
  } finally { probe.mockRestore(); create.mockRestore(); db.$client.close(); }
});
