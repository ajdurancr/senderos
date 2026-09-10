import { seedBuiltInAgents } from "../bootstrap/seed-agents";
import type { SeedAgentsOptions } from "../shared/types";
import { databaseConnectionFromEnvironment } from "./client";
import { migrateRuntimeDb } from "./migrate";

/**
 * Prepares the shared database used by detached control-plane processes.
 *
 * Unlike initializeRuntime, this does not create a Senderos home, write a
 * config file, or manage host-local artifact paths. Both migrations and the
 * built-in agent seed are idempotent.
 */
export async function prepareSharedDatabase(
  seedOptions?: SeedAgentsOptions,
) {
  databaseConnectionFromEnvironment();
  await migrateRuntimeDb();
  await seedBuiltInAgents(undefined, seedOptions);
}
