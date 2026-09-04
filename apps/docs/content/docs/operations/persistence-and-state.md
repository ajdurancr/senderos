---
title: Persistence and State
description: "Where Senderos keeps runtime configuration, structured state, and large artifacts."
---

SQLite is the authority for Senderos' structured state: projects, goals, agents,
transitions, runs, attempts, pull-request linkage, and append-only events.

By default, Senderos uses local SQLite in its home directory. Turso
configuration can be described and health-checked; local SQLite is the
command-execution backend.

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
