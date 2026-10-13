import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as libsql from "@libsql/client";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
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
