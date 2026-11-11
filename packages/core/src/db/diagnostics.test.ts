import { afterEach, expect, mock, spyOn, test } from "bun:test";
import * as libsql from "@libsql/client";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { doctor } from "../commands/system/health";
import { initHome } from "../test-support/runtime";
import { databaseConnectionFromEnvironment, describeCurrentDb, healthcheckCurrentDb, openRuntimeDb } from "./client";

afterEach(() => { mock.restore(); delete process.env.SENDEROS_TEST_DIAGNOSTIC_URL; });

for (const configured of [false, true]) test(`diagnostics redact query credentials without changing connection values (configured=${configured})`, async () => {
  const home = await initHome();
  const configPath = join(home, "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (configured) {
    config.database.urlEnv = "SENDEROS_TEST_DIAGNOSTIC_URL";
    writeFileSync(configPath, JSON.stringify(config));
  }
  const url = `file:${join(home, "senderos.db")}?authToken=synthetic-first&%61uthToken=synthetic%2Bsecond&tls=0`;
  const env = configured ? "SENDEROS_TEST_DIAGNOSTIC_URL" : "SENDEROS_DATABASE_URL";
  process.env[env] = url;
  const before = readFileSync(configPath, "utf8");
  const description = describeCurrentDb(configured ? home : undefined);
  expect(description.url).toBe(`file:${join(home, "senderos.db")}?authToken=[redacted]&%61uthToken=[redacted]&tls=0`);
  expect(process.env[env]).toBe(url);
  expect(readFileSync(configPath, "utf8")).toBe(before);
  if (!configured) expect(databaseConnectionFromEnvironment().url).toBe(url);
  const report = await doctor(home);
  expect(report.ok).toBe(true);
  expect(JSON.stringify(report)).not.toContain("synthetic");
});

test.each([
  ["libsql://synthetic-user:synthetic-password@example.test/db?authToken=synthetic-token&tls=1", "libsql://[redacted]@example.test/db?authToken=[redacted]&tls=1"],
  ["https://synthetic-user@example.test/db?unknown=synthetic-secret#synthetic-fragment", "https://[redacted]@example.test/db?[redacted]#[redacted]"],
  ["file::memory:?cache=shared", "file::memory:?cache=shared"],
  ["file::memory:?cache=private", "file::memory:?cache=private"],
  ["file::memory:?tls=synthetic-secret", "file::memory:?tls=[redacted]"],
  ["file::memory:?authToken=synthetic-token&authToken&%invalid=synthetic-secret", "file::memory:?authToken=[redacted]&authToken=[redacted]&[redacted]"],
  ["synthetic-invalid-url", "[invalid database URL]"],
])("URL presentation safely describes %s without opening a connection", (url, expected) => {
  process.env.SENDEROS_DATABASE_URL = url;
  const client = spyOn(libsql, "createClient");
  expect(describeCurrentDb().url).toBe(expected);
  expect(client).not.toHaveBeenCalled();
  expect(process.env.SENDEROS_DATABASE_URL).toBe(url);
});

test("actual local driver URL validation does not echo a rejected option value", async () => {
  const home = await initHome();
  process.env.SENDEROS_DATABASE_URL += "?authToken=synthetic-query-token&tls=synthetic-invalid-option";
  const report = await doctor(home);
  expect(report.ok).toBe(false);
  expect(report.issues.join(" ")).toContain("configured URL");
  expect(JSON.stringify(report)).not.toContain("synthetic");
});

test.each(["URL_INVALID", "SQLITE_NOTADB", "SQLITE_BUSY", "EACCES", "synthetic-error-code", undefined])("untrusted driver errors are not echoed (%s)", async code => {
  const home = await initHome();
  const url = "libsql://fixture.example.test?authToken=synthetic%2Btoken";
  process.env.SENDEROS_DATABASE_URL = url;
  const client = spyOn(libsql, "createClient").mockImplementation(() => {
    throw Object.assign(new Error(`Driver rejected ${url}, decoded synthetic+token`), { code });
  });
  const report = await doctor(home);
  expect(report.ok).toBe(false);
  expect(report.issues[0]!.length).toBeGreaterThan(30);
  expect(JSON.stringify(report)).not.toContain("synthetic");
  expect(client).toHaveBeenCalledWith({ url });
  expect(process.env.SENDEROS_DATABASE_URL).toBe(url);
});

test("missing connection configuration remains actionable", async () => {
  delete process.env.SENDEROS_DATABASE_URL;
  expect(await healthcheckCurrentDb()).toMatchObject({ ok: false, issues: ["Missing env:SENDEROS_DATABASE_URL"] });
});

test("a driver cleanup failure returns a safe unhealthy report", async () => {
  const home = await initHome();
  const client = libsql.createClient({ url: process.env.SENDEROS_DATABASE_URL! });
  const close = client.close.bind(client);
  spyOn(client, "close").mockImplementation(() => { close(); throw new Error("synthetic-cleanup-credential"); });
  spyOn(libsql, "createClient").mockReturnValue(client);
  const report = await doctor(home);
  expect(report.ok).toBe(false);
  expect(report.issues[0]).toContain("Database health check failed");
  expect(JSON.stringify(report)).not.toContain("synthetic");
});

test("URL inspection preserves an absent configured URL and empty query separators", async () => {
  const home = await initHome();
  delete process.env.SENDEROS_DATABASE_URL;
  expect(describeCurrentDb(home).url).toBeNull();
  process.env.SENDEROS_DATABASE_URL = "file::memory:?&tls=1&&";
  expect(describeCurrentDb().url).toBe("file::memory:?&tls=1&&");
});

test("cleanup failure preserves previously collected schema recovery facts", async () => {
  const home = await initHome();
  const db = openRuntimeDb(home);
  await db.$client.execute("DROP TABLE run_attempts");
  const close = db.$client.close.bind(db.$client);
  spyOn(db.$client, "close").mockImplementation(() => { close(); throw new Error("synthetic-cleanup-token"); });
  spyOn(libsql, "createClient").mockReturnValue(db.$client);
  const report = await doctor(home);
  expect(report.ok).toBe(false);
  expect(report.issues).toContain("missing table:run_attempts");
  expect(report.issues.join(" ")).toContain("Database health check failed");
  expect(JSON.stringify(report)).not.toContain("synthetic");
});

test("query failures omit credential-bearing server replies and retain the real authentication input", async () => {
  const home = await initHome();
  const client = libsql.createClient({ url: process.env.SENDEROS_DATABASE_URL! });
  const close = spyOn(client, "close");
  spyOn(client, "execute").mockRejectedValue(Object.assign(new Error("synthetic-server-response-credential"), { code: "SERVER_ERROR" }));
  const url = "libsql://synthetic-user:synthetic-password@fixture.example.test?authToken=synthetic-query-token";
  process.env.SENDEROS_DATABASE_URL = url;
  process.env.SENDEROS_DATABASE_AUTH_TOKEN = "synthetic-env-token";
  try {
    const create = spyOn(libsql, "createClient").mockReturnValue(client);
    const report = await doctor(home);
    expect(report.ok).toBe(false);
    expect(report.issues.join(" ")).toContain("credentials, access and connectivity");
    expect(JSON.stringify(report)).not.toContain("synthetic");
    expect(create).toHaveBeenCalledWith({ url, authToken: "synthetic-env-token" });
    expect(process.env.SENDEROS_DATABASE_AUTH_TOKEN).toBe("synthetic-env-token");
    expect(close).toHaveBeenCalledTimes(1);
  } finally { delete process.env.SENDEROS_DATABASE_AUTH_TOKEN; }
});

test.each(["https://synthetic-user:synthetic-password", "file://synthetic-user:synthetic-password", "libsql://synthetic-user:synthetic-password"])("malformed credential-like authorities are not displayed: %s", async url => {
  const home = await initHome();
  process.env.SENDEROS_DATABASE_URL = url;
  expect(describeCurrentDb(home).url).toBe("[invalid database URL]");
  const report = await doctor(home);
  expect(report.ok).toBe(false);
  expect(JSON.stringify(report)).not.toContain("synthetic");
});
