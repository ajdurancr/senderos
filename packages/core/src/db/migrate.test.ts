import { expect, test } from 'bun:test';

import { initHome } from '../test-support/runtime';
import { migrateRuntimeDb } from './migrate';

test('migrateRuntimeDb can safely reapply the bundled migrations', async () => {
  const home = await initHome();

  await expect(migrateRuntimeDb(home)).resolves.toBeUndefined();
});

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tempHome } from '../test-support/runtime';
test('graph upgrade preserves existing records and snapshots then-current published instructions exactly once', async () => {
  const home = tempHome(), legacy = join(home, 'legacy-migrations'); mkdirSync(join(legacy, 'meta'), { recursive: true });
  const source = resolve(import.meta.dir, '../../drizzle');
  const journal = JSON.parse(readFileSync(join(source, 'meta/_journal.json'), 'utf8')); journal.entries = journal.entries.filter((e: { idx: number }) => e.idx <= 3);
  writeFileSync(join(legacy, 'meta/_journal.json'), JSON.stringify(journal));
  for (const entry of journal.entries) copyFileSync(join(source, `${entry.tag}.sql`), join(legacy, `${entry.tag}.sql`));
  const client = createClient({ url: `file:${join(home, 'upgrade.db')}` }); const db = drizzle(client);
  try {
    await migrate(db, { migrationsFolder: legacy });
    await client.execute("INSERT INTO agents (id,slug,name,kind,status,definition_body,default_meta_json,created_at,updated_at) VALUES ('old','old','Original','custom','active','Instructions at upgrade','{\"requiredCapabilities\":[\"shell\"]}','2026-01-01','2026-01-01')");
    await client.execute("INSERT INTO senderos (id,slug,name,status,created_at,updated_at) VALUES ('workflow','workflow','Workflow','active','2026-01-01','2026-01-01')");
    await client.execute("INSERT INTO sendero_versions (id,sendero_id,version,status,created_at) VALUES ('published','workflow',1,'published','2026-01-01'),('draft','workflow',2,'draft','2026-01-01')");
    await client.execute("INSERT INTO sendero_nodes (id,sendero_version_id,agent_id,kind,label,position_x,position_y,created_at,updated_at) VALUES ('published-node','published','old','agent','Old',0,0,'2026-01-01','2026-01-01'),('draft-node','draft','old','agent','Old',0,0,'2026-01-01','2026-01-01')");
    const historicalMetadata = [
      ['string', JSON.stringify({ requiredCapabilities: 'shell' })],
      ['number', JSON.stringify({ requiredCapabilities: 7 })],
      ['object', JSON.stringify({ requiredCapabilities: { shell: true } })],
      ['null', JSON.stringify({ requiredCapabilities: null })],
      ['null-root', 'null'],
      ['invalid-json', '{invalid'],
    ] as const;
    for (const [label, metadata] of historicalMetadata) {
      await client.execute({ sql: "INSERT INTO agents (id,slug,name,kind,status,definition_body,default_meta_json,created_at,updated_at) VALUES (?,?,?,'custom','active','Historical instructions',?,'2026-01-01','2026-01-01')", args: [`old-${label}`, `old-${label}`, label, metadata] });
      await client.execute({ sql: "INSERT INTO sendero_nodes (id,sendero_version_id,agent_id,kind,label,position_x,position_y,created_at,updated_at) VALUES (?,'published',?,'agent',?,0,0,'2026-01-01','2026-01-01')", args: [`node-${label}`, `old-${label}`, label] });
    }
    await migrate(db, { migrationsFolder: source });
    const snapshot = (await client.execute("SELECT agent_snapshot_json FROM sendero_nodes WHERE id='published-node'")).rows[0]!.agent_snapshot_json as string;
    expect(JSON.parse(snapshot)).toEqual({ id: 'old', name: 'Original', instructions: 'Instructions at upgrade', requiredCapabilities: ['shell'] });
    expect((await client.execute("SELECT agent_snapshot_json FROM sendero_nodes WHERE id='draft-node'")).rows[0]!.agent_snapshot_json).toBeNull();
    expect((await client.execute("SELECT protocol_version FROM sendero_versions WHERE id='published'")).rows[0]!.protocol_version).toBe(1);
    expect((await client.execute("SELECT protocol_version FROM sendero_versions WHERE id='draft'")).rows[0]!.protocol_version).toBe(1);
    for (const [label] of historicalMetadata) {
      const value = (await client.execute({ sql: 'SELECT agent_snapshot_json FROM sendero_nodes WHERE id=?', args: [`node-${label}`] })).rows[0]!.agent_snapshot_json as string;
      expect(JSON.parse(value)).toEqual({ id: `old-${label}`, name: label, instructions: 'Historical instructions', requiredCapabilities: [] });
    }
    await client.execute("INSERT INTO sendero_versions (id,sendero_id,version,status,created_at) VALUES ('new-draft','workflow',3,'draft','2026-10-11')");
    expect((await client.execute("SELECT protocol_version FROM sendero_versions WHERE id='new-draft'")).rows[0]!.protocol_version).toBe(2);
    await client.execute("UPDATE agents SET definition_body='Later change' WHERE id='old'"); await migrate(db, { migrationsFolder: source });
    expect((await client.execute("SELECT agent_snapshot_json FROM sendero_nodes WHERE id='published-node'")).rows[0]!.agent_snapshot_json).toBe(snapshot);
    expect((await client.execute("SELECT protocol_version FROM sendero_versions WHERE id='new-draft'")).rows[0]!.protocol_version).toBe(2);
  } finally { client.close(); }
});
