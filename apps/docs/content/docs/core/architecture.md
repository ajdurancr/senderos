---
title: Runtime Architecture
description: "How the Senderos runtime, CLI, Studio, persistence, and host agents fit together."
---

Senderos is a TypeScript and Bun monorepo with three runtime-facing pieces:

- `packages/core` is the orchestration runtime and public API.
- `packages/cli` provides the `senderos` command-line interface.
- `apps/studio` consumes the runtime through a server-side facade.

```text
human or automation
  -> Senderos CLI or Studio
  -> @senderos/core
  -> SQLite runtime state
  -> planning and dispatch output
  -> host agent executes work externally
```

The runtime is the source of truth for projects, goals, agent definitions,
transitions, runs, attempts, and events. The CLI is the machine-readable control
surface. Studio uses `createSenderos({ home })`, with `SENDEROS_HOME` when set.

The host agent performs product-code work. Senderos records harness, session,
and working-path metadata on attempts, but does not launch or manage that work.

## Runtime layout

Focused actions live under `src/commands/<entity>/<action>.ts`. Projects, goals,
runs, attempts, agents, and transitions have explicit actions; generic actions
live under `config`, `planning`, and `system`. Bootstrap definitions live under
`src/bootstrap`, while scripts and test support remain under `src`.
