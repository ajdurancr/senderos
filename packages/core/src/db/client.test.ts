import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as libsql from "@libsql/client";
import { getTableName } from "drizzle-orm";
import * as schema from "./schema";
import { doctor } from "../commands/system/health";
import { existsSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join, relative } from "node:path";
import {
  atomic,
  databaseConnectionFromEnvironment,
  describeCurrentDb,
  healthcheckCurrentDb,
  openRuntimeDb,
  withDatabaseConnection,
} from "./client";
import { defaultConfigForHome } from "../shared/config";
import {
  initHome,
  tempHome,
  tursoConfigForHome,
} from "../test-support/runtime";

afterEach(() => {
  mock.restore();
  delete process.env.SENDEROS_DATABASE_AUTH_TOKEN;
  delete process.env.SENDEROS_TEST_CONNECTION_URL;
  delete process.env.SENDEROS_TEST_CONNECTION_TOKEN;
});

describe("db client", () => {
  test("describes the environment-backed connection", async () => {
    const home = await initHome();
    expect(describeCurrentDb(home)).toMatchObject({
      urlEnv: "SENDEROS_DATABASE_URL",
      url: `file:${home}/senderos.db`,
    });
  });

  test("healthcheckCurrentDb reports a healthy runtime database", async () => {
    const home = await initHome();
    expect((await healthcheckCurrentDb(home)).ok).toBe(true);
  });

  test("healthcheckCurrentDb reports configuration failures", async () => {
    const home = await initHome();
    const databaseUrl = process.env.SENDEROS_DATABASE_URL;
    delete process.env.SENDEROS_DATABASE_URL;

    try {
      await expect(healthcheckCurrentDb(home)).resolves.toMatchObject({
        ok: false,
        issues: [expect.stringContaining("Missing env")],
      });
    } finally {
      process.env.SENDEROS_DATABASE_URL = databaseUrl;
    }
  });

  test("turso test configuration declares an auth-token environment variable", () => {
    expect(tursoConfigForHome(tempHome()).database).toEqual({
      urlEnv: "SENDEROS_DATABASE_URL",
      authTokenEnv: "SENDEROS_TURSO_TOKEN",
    });
  });

  test("openRuntimeDb returns a usable libSQL connection", async () => {
    const home = await initHome();
    const db = openRuntimeDb(home);
    expect((await db.$client.execute("select 1 as value")).rows[0]?.value).toBe(1);
    db.$client.close();
  });

  test("opens an environment-provided database without a runtime config file", async () => {
    const home = tempHome();
    process.env.SENDEROS_DATABASE_URL = `file:${home}/detached.db`;

    expect(databaseConnectionFromEnvironment()).toEqual({
      url: `file:${home}/detached.db`,
    });
    expect(describeCurrentDb()).toMatchObject({
      urlEnv: "SENDEROS_DATABASE_URL",
      url: `file:${home}/detached.db`,
    });

    const db = openRuntimeDb();
    expect((await db.$client.execute("select 1 as value")).rows[0]?.value).toBe(1);
    db.$client.close();
  });
});

describe("effective database URL", () => {
  const intercepted = new Error("Client creation intercepted; no network connection");
  const interceptClient = () => spyOn(libsql, "createClient").mockImplementation(() => {
    throw intercepted;
  });

  test.each([
    ["turso://database.example.test", "libsql://database.example.test"],
    ["TuRsO://Example.test:8080/db%2Fname?tls=0&value=a%2Bb#fragment", "libsql://Example.test:8080/db%2Fname?tls=0&value=a%2Bb#fragment"],
    ["TURSO://database.example.test/", "libsql://database.example.test/"],
    ...[
      "libsql://database.example.test?tls=0",
      "https://database.example.test/path?next=turso://other.test",
      "http://127.0.0.1:8080",
      "wss://database.example.test",
      "ws://127.0.0.1:8080",
      "file::memory:",
      "file:/tmp/database.db",
      "file:///tmp/database%20name.db",
      "./database.db",
      "/tmp/database.db",
      "turso:relative.db",
      "other://database.example.test",
    ].map(url => [url, url]),
  ])("passes %s to the client with only the Turso alias normalized", (url, expected) => {
    const create = interceptClient();
    process.env.SENDEROS_DATABASE_URL = url;
    process.env.SENDEROS_DATABASE_AUTH_TOKEN = "fixture-token";

    expect(() => openRuntimeDb()).toThrow(intercepted);
    expect(create).toHaveBeenCalledWith({ url: expected, authToken: "fixture-token" });
    expect(process.env.SENDEROS_DATABASE_URL).toBe(url);
    expect(databaseConnectionFromEnvironment()).toEqual({ url, authToken: "fixture-token" });
  });

  test("normalizes the CLI's configured environment variable without rewriting config or credentials", () => {
    const home = tempHome();
    const config = defaultConfigForHome(home, "codex");
    config.database = { urlEnv: "SENDEROS_TEST_CONNECTION_URL", authTokenEnv: "SENDEROS_TEST_CONNECTION_TOKEN" };
    const configPath = join(home, "config.json");
    const before = JSON.stringify(config);
    writeFileSync(configPath, before);
    process.env.SENDEROS_TEST_CONNECTION_URL = "turso://database.example.test/path?tls=0";
    process.env.SENDEROS_TEST_CONNECTION_TOKEN = "custom-fixture-token";
    const create = interceptClient();

    expect(() => openRuntimeDb(home)).toThrow(intercepted);
    expect(create).toHaveBeenCalledWith({ url: "libsql://database.example.test/path?tls=0", authToken: "custom-fixture-token" });
    expect(readFileSync(configPath, "utf8")).toBe(before);
    expect(process.env.SENDEROS_TEST_CONNECTION_URL).toBe("turso://database.example.test/path?tls=0");
    expect(process.env.SENDEROS_TEST_CONNECTION_TOKEN).toBe("custom-fixture-token");
  });

  test("normalizes a scoped connection without mutating its caller-owned value", async () => {
    const create = interceptClient();
    const connection = Object.freeze({ url: "turso://database.example.test", authToken: "scoped-fixture-token" });
    await expect(withDatabaseConnection(connection, async () => openRuntimeDb())).rejects.toThrow(intercepted);
    expect(create).toHaveBeenCalledWith({ url: "libsql://database.example.test", authToken: "scoped-fixture-token" });
    expect(connection.url).toBe("turso://database.example.test");
  });

  test("retains file reset guards before creating a client", () => {
    const home = tempHome();
    const path = join(home, "database.db");
    writeFileSync(`${path}.senderos-reset.lock`, "locked");
    process.env.SENDEROS_DATABASE_URL = `file:${path}`;
    const create = interceptClient();

    expect(() => openRuntimeDb()).toThrow("Database reset lock exists");
    expect(create).not.toHaveBeenCalled();
  });
});


test("remote connections keep the driver's pinned transaction and rollback contract without network access", async () => {
  const commit = mock(async () => {}), rollback = mock(async () => {});
  const transaction = mock(async () => ({ commit, rollback }));
  const executeMultiple = mock(async () => {}), close = mock(() => {});
  spyOn(libsql, "createClient").mockReturnValue({
    protocol: "http", transaction, executeMultiple, close,
  } as unknown as ReturnType<typeof libsql.createClient>);
  await withDatabaseConnection({ url: "https://fixture.example.test" }, async () => {
    expect(await atomic(undefined, async () => 42)).toBe(42);
    expect(commit).toHaveBeenCalledTimes(1);
    const failure = new Error("remote fixture failure");
    await expect(atomic(undefined, async () => { throw failure; })).rejects.toBe(failure);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(rollback).toHaveBeenCalledTimes(1);
    expect(executeMultiple).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
});


describe("read-only schema health", () => {
  test.each(Object.values(schema).map(table => getTableName(table)))(
    "reports missing required table %s without repairing it", async table => {
      const home = await initHome();
      const db = openRuntimeDb(home);
      try {
        await db.$client.execute(`DROP TABLE "${table}"`);
        const before = await db.$client.execute("SELECT type, name, sql FROM sqlite_schema ORDER BY type, name");
        expect(await healthcheckCurrentDb(home)).toMatchObject({
          ok: false, issues: [expect.stringContaining(table)],
        });
        expect((await doctor(home)).ok).toBe(false);
        expect((await db.$client.execute("SELECT type, name, sql FROM sqlite_schema ORDER BY type, name")).rows).toEqual(before.rows);
      } finally { db.$client.close(); }
    },
  );

  test("reports every missing required column, even when the table is empty", async () => {
    const home = await initHome();
    const db = openRuntimeDb(home);
    try {
      await db.$client.execute("ALTER TABLE run_attempts DROP COLUMN result_json");
      await db.$client.execute("ALTER TABLE runs DROP COLUMN max_attempts");
      expect(await healthcheckCurrentDb(home)).toMatchObject({ ok: false, issues: [
        expect.stringContaining("run_attempts.result_json"), expect.stringContaining("runs.max_attempts"),
      ] });
    } finally { db.$client.close(); }
  });

  test("does not accept a view in place of a required writable table", async () => {
    const home = await initHome();
    const db = openRuntimeDb(home);
    try {
      await db.$client.execute("ALTER TABLE run_attempts RENAME TO retained_attempts");
      await db.$client.execute("CREATE VIEW run_attempts AS SELECT * FROM retained_attempts");
      expect(await healthcheckCurrentDb(home)).toMatchObject({ ok: false, issues: [expect.stringContaining("run_attempts")] });
    } finally { db.$client.close(); }
  });

  test("accepts extra tables and columns while preserving persisted history", async () => {
    const home = await initHome();
    const db = openRuntimeDb(home);
    try {
      await db.$client.execute("CREATE TABLE operator_notes (id TEXT, body TEXT)");
      await db.$client.execute("INSERT INTO operator_notes VALUES ('note', 'retained operator fact')");
      await db.$client.execute("ALTER TABLE run_attempts ADD COLUMN future_fact TEXT");
      await db.$client.execute({ sql: `INSERT INTO run_attempts
        (id, run_id, attempt_number, agent_id, status, execution_objective, harness, retry_from_attempt_id, result_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: ["attempt", "run", 2, "agent", "failed", "retained objective", "fixture", "prior", '{"fact":"retained evidence"}', "2026-01-01", "2026-01-01"] });
      const before = await db.$client.execute("SELECT * FROM run_attempts ORDER BY id");
      expect(await healthcheckCurrentDb(home)).toEqual({ ok: true, issues: [], warnings: [] });
      expect((await db.$client.execute("SELECT * FROM run_attempts ORDER BY id")).rows).toEqual(before.rows);
      expect((await db.$client.execute("SELECT body FROM operator_notes")).rows.map(row => row.body)).toEqual(["retained operator fact"]);
    } finally { db.$client.close(); }
  });
});

test("schema health works without a home and leaves a caller's transaction usable", async () => {
  const home = await initHome();
  expect((await healthcheckCurrentDb()).ok).toBe(true);
  await atomic(home, async () => {
    expect((await healthcheckCurrentDb(home)).ok).toBe(true);
    await openRuntimeDb(home).$client.execute("CREATE TABLE operator_transaction (fact TEXT)");
  });
  const db = openRuntimeDb(home);
  try { expect((await db.$client.execute("SELECT * FROM operator_transaction")).rows).toEqual([]); }
  finally { db.$client.close(); }
});


describe("diagnostics preserve missing local database files", () => {
  test.each(["plain", "encoded", "relative", "dangling symlink"])("reports a missing %s file without creating it", async kind => {
    const home = await initHome();
    const path = join(home, "absent database.db");
    const link = join(home, "missing-link.db");
    if (kind === "dangling symlink") symlinkSync(path, link);
    process.env.SENDEROS_DATABASE_URL = kind === "encoded" ? pathToFileURL(path).href
      : kind === "relative" ? `file:${relative(process.cwd(), path)}`
      : `file:${kind === "dangling symlink" ? link : path}`;
    expect(existsSync(path)).toBe(false);
    expect(await healthcheckCurrentDb(home)).toMatchObject({ ok: false, issues: [expect.stringContaining("missing database:")] });
    expect((await doctor(home)).ok).toBe(false);
    expect(existsSync(path)).toBe(false);
  });

  test("retains reset-lock guidance when a missing database is fenced", async () => {
    const home = await initHome();
    const path = join(home, "absent.db");
    const lock = `${path}.senderos-reset.lock`;
    writeFileSync(lock, "operator lock");
    process.env.SENDEROS_DATABASE_URL = `file:${path}`;
    expect(await healthcheckCurrentDb(home)).toMatchObject({ ok: false, issues: [expect.stringContaining("Database reset lock exists")] });
    expect(existsSync(path)).toBe(false);
    expect(readFileSync(lock, "utf8")).toBe("operator lock");
  });

  test("operational connections retain explicit database creation", async () => {
    const home = tempHome();
    const path = join(home, "new.db");
    process.env.SENDEROS_DATABASE_URL = `file:${path}`;
    expect((await healthcheckCurrentDb()).ok).toBe(false);
    expect(existsSync(path)).toBe(false);
    const db = openRuntimeDb();
    try { await db.$client.execute("CREATE TABLE operator_created (id TEXT)"); }
    finally { db.$client.close(); }
    expect(existsSync(path)).toBe(true);
  });

  test("a removed initialized fixture is not recreated by doctor", async () => {
    const home = await initHome();
    const path = join(home, "senderos.db");
    rmSync(path);
    expect((await doctor(home)).ok).toBe(false);
    expect(existsSync(path)).toBe(false);
  });
});


test("schema diagnostics accept an existing encoded local file and reject directories without opening them", async () => {
  const home = await initHome();
  const path = join(home, "stored database.db");
  renameSync(join(home, "senderos.db"), path);
  process.env.SENDEROS_DATABASE_URL = pathToFileURL(path).href;
  expect(process.env.SENDEROS_DATABASE_URL).toContain("%20");
  expect((await healthcheckCurrentDb(home)).ok).toBe(true);
  const link = join(home, "existing-link.db");
  symlinkSync(path, link);
  process.env.SENDEROS_DATABASE_URL = `file:${link}`;
  expect((await healthcheckCurrentDb(home)).ok).toBe(true);
  process.env.SENDEROS_DATABASE_URL = pathToFileURL(home).href;
  expect(await healthcheckCurrentDb(home)).toMatchObject({ ok: false, issues: [expect.stringContaining("not a database file:")] });
});

test("schema diagnostics retain memory and remote driver routing without network access", async () => {
  for (const url of ["file::memory:", "file::memory:?cache=shared", "https://fixture.example.test"]) {
    process.env.SENDEROS_DATABASE_URL = url;
    const intercepted = new Error("fixture driver intercepted");
    const create = spyOn(libsql, "createClient").mockImplementation(() => { throw intercepted; });
    expect(await healthcheckCurrentDb()).toEqual({ ok: false, issues: [intercepted.message], warnings: [] });
    expect(create).toHaveBeenCalledWith({ url });
    create.mockRestore();
  }
});
