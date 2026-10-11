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
