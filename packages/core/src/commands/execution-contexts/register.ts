import { eq } from 'drizzle-orm';

import { openRuntimeDb } from '../../db/client';
import { executionContexts } from '../../db/schema';
import { now } from '../../shared/ids';

export async function registerExecutionContext(input: { home?: string; id: string; name: string }) {
  const name = input.name.trim();
  if (!name) throw new Error('Execution context name is required.');
  const db = openRuntimeDb(input.home);
  const existing = (await db.select().from(executionContexts).where(eq(executionContexts.id, input.id)))[0];
  if (existing) {
    if (existing.name !== name)
      throw new Error(`Execution context ${input.id} is already registered as "${existing.name}".`);
    return existing;
  }
  const sameName = (await db.select().from(executionContexts).where(eq(executionContexts.name, name)))[0];
  if (sameName)
    throw new Error(`Execution context name is already in use: "${name}".`);
  const ts = now();
  await db.insert(executionContexts).values({ id: input.id, name, createdAt: ts, updatedAt: ts });
  return (await db.select().from(executionContexts).where(eq(executionContexts.id, input.id)))[0]!;
}
