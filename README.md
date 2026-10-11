# Senderos

See the [lifecycle and host integration contract](docs/lifecycle-contract.md) for
preflight/claim/start/heartbeat/report, graph publication, recovery, and upgrade guidance.

Senderos is a persistent orchestration platform for user-defined agents and directed workflows. It coordinates goals, branching work, host ownership, evidence, and recovery while external hosts perform the actual execution. Software-delivery workflows are bundled examples, not required roles or project types.

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

Users and teams can delegate work to many tools and agents, but delegation alone does not guarantee useful outcomes.

The harder problem is coordination:

- turning goals into executable work
- bringing the right context to the right moment
- validating whether the result actually works
- keeping humans, tools, and automation aligned
- preserving decisions so the system improves over time

Senderos exists to make that coordination visible, structured, and repeatable.

## Product thesis

Coordination should remain explicit and durable even when work spans different tools, sessions, and machines.

Senderos exists to orchestrate the path from intent to verified delivery:

Intent → Planning → Context → Execution → Validation → Feedback → Continuous Improvement

## How Senderos currently works

At the runtime level, Senderos acts as a control plane:

- it stores orchestration state through Drizzle on a configurable libSQL connection
- it derives durable graph activations, outcome branches, bounded cycles, fan-out, and explicit joins
- it plans the next dispatchable work with `senderos plan`
- it accepts explicit dispatch requests with `senderos run dispatch ...`
- it records projects, goals, agent transitions, runs, run attempts, and events
- projects can organize non-repository work; instructions, completion gates, and agent roles are configurable
- it does **not** perform the actual work itself

The host agent is the execution plane:

- asks Senderos what is dispatchable next
- reserves Core-selected activations idempotently, including concurrent branches
- declares verified capabilities and workspace access, claims work, and starts independent worker sessions
- executes the real work in its own environment and working path
- returns later for the next plan/dispatch cycle

## Getting started

### Prerequisites

- Bun `>=1.3`

### Install

```bash
bun install
```

### Run the external-host example without API keys

```bash
bun run simulate:host --output .tmp/external-host-report.json
```

This runs real CLI subprocesses and independent workers across three simulated
host contexts, each with its own workspace, sharing one local libSQL database.
The JSON report covers routing, ownership, races, recovery, and completion gates.
See [the runnable adapter](examples/external-host/README.md) and
[acceptance matrix](docs/external-host-acceptance.md) for verified boundaries.

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
bun run coverage
```

For the current runtime model and operator workflow, see `apps/docs` or run
`bun run dev:docs`.

## Repository structure

- Root: monorepo workspace, shared config, and top-level documentation only
- `packages/core`: Senderos runtime, bootstrap definitions, and test support
- `packages/cli`: Senderos CLI
- `apps/studio`: Studio web app
- `apps/docs`: product/operator docs for Senderos
