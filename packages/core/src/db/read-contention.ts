import type { Client, InStatement, InArgs } from '@libsql/client';

/** Retry only standalone local SELECTs; transactions own rollback/replay policy. */
export function retryLocalReads(client: Client, inTransaction: () => boolean) {
  if (client.protocol !== 'file') return;
  const execute = client.execute.bind(client);
  client.execute = async (statement: InStatement, args?: InArgs) => {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    const retryable = /^\s*SELECT\b/i.test(sql) && !inTransaction();
    const deadline = performance.now() + 1000;
    let delay = 5;
    for (;;) {
      try { return await (typeof statement === 'string' ? execute(statement, args) : execute(statement)); }
      catch (error) {
        const failure = error as { code?: string; extendedCode?: string } | null;
        const code = failure?.extendedCode ?? failure?.code;
        // BUSY_SNAPSHOT needs a transaction restart, not a statement replay.
        if (!retryable || (code !== 'SQLITE_BUSY' && code !== 'SQLITE_BUSY_RECOVERY') || performance.now() >= deadline) throw error;
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(delay, Math.max(0, deadline - performance.now()))));
      delay = Math.min(delay * 2, 100);
    }
  };
}
