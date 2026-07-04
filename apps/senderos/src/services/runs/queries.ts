import { openRuntimeDb } from '../../db/client';
import { mapTaskRow } from '../../db/mappers';

export function getWorkspace(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = db.query('select * from workspaces where id=?').get(id);
  db.close();

  return row;
}

export function getRun(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = db.query('select * from runs where id=?').get(id);
  db.close();

  return row;
}

export function getSession(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = db.query('select * from sessions where id=?').get(id);
  db.close();

  return row;
}

export function getTask(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapTaskRow(db.query('select * from tasks where id=?').get(id));
  db.close();

  return row;
}

export function listTasks(featureId: string, home?: string) {
  const db = openRuntimeDb(home);
  const rows = db
    .query('select * from tasks where feature_id=? order by created_at asc')
    .all(featureId)
    .map(mapTaskRow);
  db.close();

  return rows.filter(Boolean);
}
