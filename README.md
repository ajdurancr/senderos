# Senderos

Senderos is an engineering orchestration platform that transforms objectives into verified software outcomes by coordinating humans, AI systems, development tools, organizational knowledge, and continuous feedback loops.

This repository contains the Senderos monorepo.

## Monorepo packages and apps

- `packages/core` — Senderos, the orchestration engine and public API.
- `packages/cli` — the `senderos` command-line interface.
- `apps/studio` — Senderos Studio, the primary product UI built with React Router.
- `apps/docs` — product and operator documentation.

## Technology decisions

- **Language:** TypeScript only
- **Package manager/runtime:** Bun
- **Monorepo:** Bun workspaces
- **UI app:** React Router v8+ (latest available at scaffold time)

## Why Senderos exists

Software teams can generate more code than ever, but generation alone does not guarantee useful outcomes.

The harder problem is coordination:

- turning goals into executable work
- bringing the right context to the right moment
- validating whether the result actually works
- keeping humans, tools, and automation aligned
- preserving decisions so the system improves over time

Senderos exists to make that coordination visible, structured, and repeatable.

## Product thesis

Software generation is no longer the main bottleneck.
Coordination is.

Senderos exists to orchestrate the path from intent to verified delivery:

Intent → Planning → Context → Execution → Validation → Feedback → Continuous Improvement

## How Senderos currently works

At the runtime level, Senderos acts as a control plane:

- it stores orchestration state through Drizzle on a configurable libSQL connection
- it plans the next dispatchable work with `senderos plan`
- it accepts explicit dispatch requests with `senderos run dispatch ...`
- it records projects, goals, agent transitions, runs, run attempts, and events
- it does **not** perform the actual coding work itself

The host agent is the execution plane:

- asks Senderos what is dispatchable next
- dispatches one run at a time
- executes the real work in its own environment and working path
- returns later for the next plan/dispatch cycle

## Getting started

### Prerequisites

- Bun `>=1.3`

### Install

```bash
bun install
```

### Run the apps

```bash
bun run dev:cli
bun run dev:studio
```

### Quality gates

```bash
bun run typecheck
bun run test
bun run build
```

For the current runtime model and operator workflow, see `apps/docs` or run
`bun run dev:docs`.

## Repository structure

- Root: monorepo workspace, shared config, and top-level documentation only
- `packages/core`: Senderos runtime, bootstrap definitions, and test support
- `packages/cli`: Senderos CLI
- `apps/studio`: Studio web app
- `apps/docs`: product/operator docs for Senderos
