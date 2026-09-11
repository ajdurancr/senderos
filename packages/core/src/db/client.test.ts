import { describe, expect, test } from "bun:test";
import {
  databaseConnectionFromEnvironment,
  describeCurrentDb,
  healthcheckCurrentDb,
  openRuntimeDb,
} from "./client";
import {
  initHome,
  tempHome,
  tursoConfigForHome,
} from "../test-support/runtime";

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
    const db = openRuntimeDb(home) as any;
    expect(await db.get("select 1 as value")).toEqual({ value: 1 });
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

    const db = openRuntimeDb() as any;
    expect(await db.get("select 1 as value")).toEqual({ value: 1 });
    db.$client.close();
  });
});
