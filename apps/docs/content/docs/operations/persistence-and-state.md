---
title: Persistence and State
description: "How Senderos stores durable state in SQLite, when Turso is used, and what still lives in the Senderos home directory."
---

Senderos stores orchestration state in SQLite.
That is the default and the baseline model.

## Supported database modes

### Local SQLite

By default, Senderos creates and uses a local SQLite database inside the Senderos home directory.

This is the standard deployment mode.

### Remote SQLite-compatible service

Senderos also supports a SQLite-compatible remote service, with Turso as the supported option.

Turso is integrated as a built-in Senderos database adapter. The rest of Senderos resolves a database adapter from configuration instead of hard-coding database behavior into higher-level orchestration code.

The model does not change between local SQLite and Turso.
The schema stays the same.
The difference is only where the database is hosted and which built-in adapter is selected.

## What lives in SQLite

All durable Senderos entity state lives in SQLite:

- features,
- tasks,
- runs,
- sessions,
- workspaces,
- events,
- configuration references,
- loop state,
- reconciliation state.

SQLite is the state authority.

## What does not live in SQLite

Large artifacts stay on disk inside the Senderos home directory and are referenced from SQLite:

- logs,
- transcripts,
- generated reports,
- temporary execution files,
- cached instruction payloads,
- exported artifacts.

## Senderos home directory

```text
~/.senderos/
  config.json
  senderos.db
  artifacts/
  logs/
  sessions/
  workspaces/
  cache/
```

When Turso is used, `senderos.db` is replaced by remote database configuration, but the rest of the home directory still exists.

## Configuration file

Senderos uses a single `config.json` file with the minimum required runtime configuration.

It defines:

- database mode,
- local SQLite path or Turso connection parameters,
- workspace root path,
- artifact directories,
- default harness,
- machine-readable output defaults,
- guardrail settings.

## Guardrail: state never spills outside Senderos

Senderos state and Senderos-managed artifacts never live outside the Senderos directory structure.

The system may instruct the host agent to operate inside a Senderos-managed workspace, but Senderos itself does not mutate arbitrary locations on the machine.
