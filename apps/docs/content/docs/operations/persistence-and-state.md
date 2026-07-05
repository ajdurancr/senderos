---
title: Persistence and State
description: "How Senderos stores durable state in SQLite, when Turso is used, and what still lives in the Senderos home directory."
---

Senderos stores orchestration state in SQLite.

By default, Senderos creates and uses a local SQLite database inside the Senderos home directory.

Senderos also supports a SQLite-compatible remote service, with Turso as the supported option.
Turso is integrated as a built-in Senderos database adapter. The rest of Senderos resolves a database adapter from configuration instead of hard-coding database behavior into higher-level orchestration code.

## What lives in SQLite

All durable Senderos entity state lives in SQLite:

- projects
- features
- runs
- run executions
- tasks
- sessions
- workspaces
- agents
- senderos
- events

## What stays on disk

Large artifacts stay on disk inside the Senderos home directory and are referenced from SQLite:

- logs
- transcripts
- reports
- cached payloads
- temporary workspace files

## Senderos home directory

Senderos uses a single `config.json` file with the minimum required runtime configuration.
