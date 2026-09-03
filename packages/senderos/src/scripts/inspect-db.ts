import { resolveRuntime } from '../shared/config';
import { openRuntimeDb } from '../db/client';

const home = process.argv[2];
const { paths } = resolveRuntime(home);
const db = openRuntimeDb(home);
const tables = db
  .query("select name from sqlite_master where type='table' order by name")
  .all()
  .map((row: unknown) => (row as { name: string }).name);

console.log(
  JSON.stringify({ home: paths.home, database: paths.dbPath, tables }, null, 2),
);
db.close();
