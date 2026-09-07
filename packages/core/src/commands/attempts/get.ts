import { openRuntimeDb } from '../../db/client';
import { mapRunAttemptRow } from '../../db/mappers';
import { runAttempts } from '../../db/schema';
import { eq } from 'drizzle-orm';

export async function getRunAttempt(id: string, home?: string) {
  const db = openRuntimeDb(home);
  const row = mapRunAttemptRow((await db.select().from(runAttempts).where(eq(runAttempts.id, id)))[0]);
  return row;
}
