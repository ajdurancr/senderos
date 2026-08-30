---
title: Persistence and State
description: "How Senderos stores durable state in SQLite, when Turso is used, and what still lives in the Senderos home directory."
---

Senderos stores orchestration state in SQLite.

By default, Senderos creates and uses a local SQLite database inside the Senderos home directory.

The configuration has a database-adapter shape, but the current operational
implementation initializes and uses the local SQLite adapter.

## What lives in SQLite

All durable Senderos entity state lives in SQLite:

- projects
- goals
- runs
- agents
- agent transitions
- run attempts
- events

## What stays on disk

Large artifacts stay on disk inside the Senderos home directory and are referenced from SQLite:

- logs
- transcripts
- reports
- cached payloads

## Senderos home directory

Senderos uses a single `config.json` file with the minimum required runtime configuration.
