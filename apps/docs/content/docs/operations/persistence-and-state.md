---
title: Persistence and State
description: "How SenderOS stores durable state in SQLite, when Turso is used, and what still lives in the SenderOS home directory."
---

SenderOS stores orchestration state in SQLite.
That is the default and the baseline model.

## Supported database modes

### Local SQLite

By default, SenderOS creates and uses a local SQLite database inside the SenderOS home directory.

This is the standard executable deployment mode today.

### Remote SQLite-compatible service

SenderOS also supports a SQLite-compatible remote service, with Turso as the supported option.

Turso is integrated as a built-in SenderOS database adapter. The rest of SenderOS resolves a database adapter from configuration instead of hard-coding database behavior into higher-level orchestration code.

The model does not change between local SQLite and Turso.
The schema stays the same.
The difference is only where the database is hosted and which built-in adapter is selected.

At the current implementation level, Turso participates in configuration, adapter resolution, and adapter health checks. The synchronous command-execution path still runs through the local SQLite adapter.

## What lives in SQLite

All durable SenderOS entity state lives in SQLite:

- projects
- features
- tasks
- runs
- run attempts
- sessions
- workspaces
- events
- configuration references
- loop state
- reconciliation state

SQLite is the state authority.

## What does not live in SQLite

Large artifacts stay on disk inside the SenderOS home directory and are referenced from SQLite:

- logs
- transcripts
- generated reports
- temporary execution files
- cached instruction payloads
- exported artifacts

## SenderOS home directory

A typical runtime created from the current repository-local workflow looks like this:

```text
<workspace>/.senderos/
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

SenderOS uses a single `config.json` file with the minimum required runtime configuration.

It defines:

- database mode
- local SQLite path or Turso connection parameters
- workspace root path
- artifact directories
- default harness
- machine-readable output defaults
- guardrail settings
