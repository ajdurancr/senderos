---
title: Persistence and State
description: "Where Senderos keeps runtime configuration, structured state, and large artifacts."
---

The configured libSQL database is the authority for Senderos' structured state:
projects, goals, agents, transitions, runs, attempts, pull-request linkage, and
append-only events. Runtime code accesses that state through Drizzle schemas and
query builders.

By default, `senderos init` sets `SENDEROS_DATABASE_URL` to a local `file:` URL
in the Senderos home directory. To use a remote libSQL service, set the URL in
the configured environment variable and, when required, provide its token in
`SENDEROS_DATABASE_AUTH_TOKEN`. The same Drizzle runtime and migrations are used
for both local and remote connections.

Large artifacts remain under the configured home:

```text
./.senderos/
  config.json
  senderos.db
  artifacts/
  logs/
  cache/
```

An attempt's `working_path` records the checkout selected by the host agent. It
is audit metadata, not a Senderos-managed workspace.

## Multiple contexts and hosts

Contexts may share the coordination database. Each host still has its own runtime
home, tools, and independently provisioned workspace. Register a distinct identity
for each tool/machine, grant project access from the owning context, and declare
the actual local path from the executing context. A workspace reference is not a
file transfer, and no checkout or artifact synchronization happens automatically.

Database scoping is a coordination boundary, not authentication. Treat database
credentials as trusted access and protect them accordingly. Ordinary attempt
inspection exposes safe ownership and lease metadata, never claim tokens.

## Local database reset

For an intentional fresh start, `senderos db reset --home /absolute/path/.senderos`
reads the configured URL, previews the exact local target and requires terminal
confirmation. Stop all writers first. The command clears every context in that
file, restores the selected context and built-in seeds, and retains a private
recovery backup. Config, repositories and artifact files are not cleared. See
[the reset operator guide](../../cli/db/) for safeguards and recovery limits.

## Brief local read contention

For a local file database, standalone SELECT statements yield while SQLite
reports `SQLITE_BUSY` or `SQLITE_BUSY_RECOVERY`, for up to one second per
statement. This lets a brief writer finish without immediately failing an
operator snapshot or CLI read. The same statement and bindings are retried;
this does not cache old facts or restart the whole operator request.

Persistent contention still fails with the database error. Check for another
process holding a long transaction before retrying. Mutation statements and
reads inside Senderos transactions keep their existing rollback and retry
policy; remote database calls are unchanged. This handling does not establish
the cause of an unrelated external-host simulator timeout.

Cold local preparation also yields for up to one second when SQLite contention
blocks Drizzle's initial `CREATE TABLE IF NOT EXISTS "__drizzle_migrations"`
statement. Only that exact idempotent metadata statement permits restarting
preparation, before migration selection or the transactional migration batch.
Migration writes, seed operations, remote databases, snapshot conflicts and
unrelated errors retain their existing behavior. Persistent contention remains
an error; a later explicit request can retry preparation after the lock clears.


Studio snapshot requests explicitly close their owned database clients after
preparation and all nested reads finish. Parallel read groups finish their
siblings before propagating the original failure, so cleanup cannot interrupt
another read in the same request. Existing transactions and nested database
scopes remain owned by their caller. This changes resource lifetime without
replaying snapshots, altering retained history, or introducing transaction retries.
