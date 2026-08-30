---
title: Runtime Boundaries
description: "The CLI, persistence, planning, and host-execution boundaries in Senderos."
---

Senderos has four explicit boundaries:

- The CLI is the public, machine-readable control surface.
- Runtime services own projects, goals, agents, transitions, runs, attempts, and events.
- SQLite is the durable source of orchestration state.
- The host agent executes product-code work outside Senderos.

```text
human or automation
  -> Senderos CLI
  -> SQLite-backed planning and dispatch services
  -> planned goal / transition / agent
  -> host agent executes externally
```

Senderos does not allocate workspaces, launch coding agents, or implement broad
GitHub, issue-tracker, notification, or scheduler integrations. It records the
state needed to make host-driven execution auditable and repeatable.
