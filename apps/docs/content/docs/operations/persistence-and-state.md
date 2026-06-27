---
title: Persistence and State
description: "How Senderos should persist structured data, artifacts, sessions, and event history."
---

## Persistence goals

Senderos needs persistence because orchestration without durability is theater.

The system should preserve enough information to:

- resume work,
- inspect failures,
- generate reports,
- recover from crashed sessions,
- prove whether cleanup happened.

## Recommended storage split

### Structured state: SQLite

SQLite is a strong default because it is:

- local,
- transactional,
- easy to inspect,
- easy to back up,
- enough for single-user and small-team local-first workflows.

Tables usually include:

- `features`,
- `tasks`,
- `runs`,
- `sessions`,
- `sources`,
- `schedules`,
- `workspaces`,
- `events`,
- `artifacts`.

### File artifacts: filesystem

Large or human-facing artifacts should live on disk, for example:

- specs,
- generated Gherkin,
- logs,
- transcripts,
- patches,
- reports,
- cached external payloads.

A typical home directory could look like:

```text
~/.senderos/
  senderos.db
  config.yaml
  artifacts/
  logs/
  cache/
  workspaces/
```

## Event log

An append-only event stream is extremely useful even if Senderos does not go full event-sourcing monk mode.

Typical events:

- `feature.created`,
- `feature.approved`,
- `run.started`,
- `run.failed`,
- `session.attached`,
- `session.heartbeat.missed`,
- `workspace.cleaned`,
- `schedule.executed`.

This is how the system later answers “what actually happened?” without making up stories.
