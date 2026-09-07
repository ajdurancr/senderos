import { openRuntimeDb } from '../../db/client';
import { emitEvent } from '../../shared/events';
import { now } from '../../shared/ids';
import { listRunAttempts } from '../attempts/list';
import { updateRunAttempt } from '../attempts/update';
import { cancelGoal } from '../goals/cancel';
import { getRun } from './get';
import { sql } from 'drizzle-orm';
export async function cancelRun(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const run: any = (await db.all(sql`select * from runs where id=${id}`))[0];
  /* c8 ignore next 3 -- exercised branch is not attributed by Bun's coverage output. */
  if (!run) {
    throw new Error(`Run not found: ${id}`);
  }
  await db.run(sql`update runs set status='canceled',updated_at=${now()} where id=${id}`);
  for (const attempt of (await listRunAttempts(id, home)).filter((item) =>
    ['queued', 'running', 'paused'].includes(item.status),
  ))
    await updateRunAttempt(
      attempt.id,
      {
        status: 'canceled',
        finishedAt: now(),
        failureSummary: 'Run canceled by Senderos.',
      },
      home,
    );
  await emitEvent(db, 'run.canceled', 'run', id, {});
  await cancelGoal(run.goal_id, home);
  return getRun(id, home);
}
