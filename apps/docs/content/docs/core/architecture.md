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
transitions, activations, runs, attempts, host ownership, evidence, review decisions,
and events. The CLI is the machine-readable control surface. Studio uses the shared
`SENDEROS_DATABASE_URL` environment configuration and an all-context Core facade;
its reviewed dispatch actions validate the requested context/project scope.

Studio combines agent and graph authoring with operational Mission Control. Draft
graphs are validated and published through Core. Decision queues show ready
activations, failed or blocked work, and evidence awaiting review. Goal views keep
branch visits separate from logical runs and concrete attempts. Attempt evidence
and review decisions are persisted in the attempt status snapshot and mirrored in
the append-only event stream.

External hosts perform the configured work. Senderos checks declared capabilities,
workspace grants, ownership and independent-session start records, but does not
launch workers, inspect processes, transfer files, or execute tools.

## Runtime layout

Focused actions live under `src/commands/<entity>/<action>.ts`. Projects, goals,
runs, attempts, agents, and transitions have explicit actions; generic actions
live under `config`, `planning`, and `system`. Bootstrap definitions live under
`src/bootstrap`, while scripts and test support remain under `src`.
