# Architecture — Senderos Runtime Boundaries

## Monorepo shape

- `apps/senderos` — orchestration runtime and domain logic
- `apps/studio` — user-facing web application
- `packages/` — shared TypeScript packages as the platform grows

## Principles

1. Coordination before complexity.
2. Typed state before guesswork.
3. Verification before closure.
4. Canonical contracts in runtime state, not scattered files.
5. GitHub-backed project execution only.
6. Bun-first workflows.

## Boundaries

- Senderos owns orchestration/runtime concerns.
- Senderos is the system of record for approved specs, Gherkin feature contracts, lifecycle state, event history, agent definitions, sendero assignments, run execution metadata, and planning/dispatch state.
- Studio owns product experience and operator workflows.
- Shared abstractions move into `packages/` only when reused by at least two apps.

## Core model

### Project
A project combines:

- canonical local repository path
- canonical GitHub repo identity
- target branch
- inferred setup commands
- health state

### Feature
A feature is the durable work container.
It stores approved spec context plus the canonical Gherkin contract and later gains branch/PR linkage.

### Agent
An agent is a first-class runtime executor.
Built-in agents are seeded from JSON records under `db-seeds/agents/` at init time and then managed as runtime records.
The paired Markdown files under `agents/` remain the human-readable role definitions.

### Sendero
A sendero is the persisted path a feature follows.
It is assigned to a source agent and may point toward a target agent as the next goal boundary.

### Run
A run is the primary execution request against one feature.
Runs are retry-aware, branch-aware, richly stateful, and may be explicitly bound to an agent and sendero through plan output and dispatch input.

### Sendero Supervisor
A Sendero Supervisor is an ephemeral runtime concern, not a persisted model.
It reads feature/run/session state, decides whether the next dispatch is possible, and advances the sendero step only through existing persisted entities.

### Run execution state
Each run carries concrete execution context through linked `run_executions`, including:

- host environment name
- host environment session id
- checkpoints
- status snapshots
- result/failure metadata

### Host-agent contract
The host agent interacts with Senderos in two phases:

1. `senderos plan` returns minimal dispatchable items.
2. `senderos run dispatch ...` consumes one planning item and creates the persisted runtime state for one external execution session.

Senderos does not perform the real coding work.
The host agent does.

### Event stream
The append-only event stream exists to make state transitions explainable instead of mystical.
