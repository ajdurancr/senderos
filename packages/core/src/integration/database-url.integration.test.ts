import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { openRuntimeDb } from "../db/client";
import { defaultConfigForHome } from "../shared/config";
import { tempHome } from "../test-support/runtime";

test.each(["Studio environment", "CLI runtime config"])("%s executes through the real libSQL client using the Turso alias", async (source) => {
  const requests: Array<{ path: string; body: unknown }> = [];
  // A loopback Hrana fixture exercises libSQL's URL parsing and HTTP transport.
  // No remote database or inherited authentication settings are used.
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const body = await request.json() as { requests: Array<{ type: string; stmt?: { sql?: string } }> };
      requests.push({ path: new URL(request.url).pathname, body });
      return Response.json({
        baton: null,
        base_url: null,
        results: body.requests.map(item => ({
          type: "ok",
          response: item.type === "close" ? { type: "close" } : {
            type: "execute",
            result: {
              cols: [{ name: "value", decltype: "INTEGER" }],
              rows: [[{ type: "integer", value: "1" }]],
              affected_row_count: 0,
              last_insert_rowid: null,
            },
          },
        })),
      });
    },
  });
  const url = `TuRsO://127.0.0.1:${server.port}?tls=0`;
  process.env.SENDEROS_DATABASE_URL = url;
  delete process.env.SENDEROS_DATABASE_AUTH_TOKEN;
  const home = source === "CLI runtime config" ? tempHome() : undefined;
  if (home) writeFileSync(join(home, "config.json"), JSON.stringify(defaultConfigForHome(home, "codex")));
  let db: ReturnType<typeof openRuntimeDb> | undefined;
  try {
    db = openRuntimeDb(home);
    expect((await db.$client.execute("SELECT 1 AS value")).rows[0]?.value).toBe(1);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ path: "/v2/pipeline", body: { requests: [{ type: "execute", stmt: { sql: "SELECT 1 AS value" } }, { type: "close" }] } });
    expect(process.env.SENDEROS_DATABASE_URL).toBe(url);
  } finally {
    db?.$client.close();
    server.stop(true);
  }
});
