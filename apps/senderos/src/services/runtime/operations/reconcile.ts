import { openConfiguredCommandDb } from '../../../db/client';
import { now } from '../../../utils/common';
import { emitEvent } from '../../events';

export function reconcile(home?: string) {
  const db = openConfiguredCommandDb(home);
  const stale = db.query("select * from sessions where status='stale'").all() as any[];
  const repairedSessions: string[] = [];
  const releasedWorkspaces: string[] = [];
  const revivedTasks: string[] = [];

  for (const session of stale) {
    db.prepare("update sessions set status='failed', updated_at=? where id=?").run(now(), session.id);

    if (session.run_id) {
      const run = db.query('select * from runs where id=?').get(session.run_id) as any;
      db.prepare("update runs set status='failed', result_json=?, updated_at=? where id=? and status in ('queued','running')")
        .run(JSON.stringify({ reason: 'stale_session' }), now(), session.run_id);

      if (run?.task_id) {
        db.prepare("update tasks set status='ready', result_json=?, updated_at=? where id=? and status='running'")
          .run(JSON.stringify({ reason: 'reconcile_restart' }), now(), run.task_id);
        revivedTasks.push(run.task_id);
      }
    }

    repairedSessions.push(session.id);
  }

  const orphaned = db.query(
    "select * from workspaces where status in ('locked','active','verifying') and (session_id is null or session_id not in (select id from sessions where status='active'))"
  ).all() as any[];

  for (const workspace of orphaned) {
    db.prepare("update workspaces set status='released', updated_at=? where id=?").run(now(), workspace.id);
    releasedWorkspaces.push(workspace.id);
  }

  emitEvent(db, 'reconciliation.completed', 'system', 'senderos', {
    repairedSessions,
    releasedWorkspaces,
    revivedTasks,
  });

  db.close();
  return { repairedSessions, releasedWorkspaces, revivedTasks };
}
