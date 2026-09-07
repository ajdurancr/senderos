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
  -> Drizzle -> libSQL runtime state
  -> planning and dispatch output
  -> host agent executes work externally
```

The runtime is the source of truth for projects, goals, agent definitions,
transitions, runs, attempts, evidence, review decisions, and events. The CLI is
the machine-readable control surface. Studio uses `createSenderos({ home })`,
with `SENDEROS_HOME` when set.

Studio is an operational Mission Control, not a workflow builder. Its primary
surface is a decision queue: dispatchable goals, failed or stale attempts, and
evidence awaiting a review decision. A goal view keeps outcome-level state
separate from its logical runs and concrete attempts. Attempt evidence and review
decisions are persisted in the attempt status snapshot and mirrored in the
append-only event stream.

The host agent performs product-code work. Senderos records harness, session,
and working-path metadata on attempts, but does not launch or manage that work.

## Runtime layout

Focused actions live under `src/commands/<entity>/<action>.ts`. Projects, goals,
runs, attempts, agents, and transitions have explicit actions; generic actions
live under `config`, `planning`, and `system`. Bootstrap definitions live under
`src/bootstrap`, while scripts and test support remain under `src`.
