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
~/.senderos/
  config.json
  senderos.db
  artifacts/
  logs/
  cache/
```

An attempt's `working_path` records the checkout selected by the host agent. It
is audit metadata, not a Senderos-managed workspace.
