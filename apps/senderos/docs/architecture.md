# Architecture — SenderOS Runtime Boundaries

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

- SenderOS owns orchestration/runtime concerns.
- SenderOS is the system of record for approved specs, Gherkin feature contracts, lifecycle state, event history, agent definitions, sendero assignments, and run execution metadata.
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
Built-in agents are seeded from markdown definitions at init time and then managed as runtime records.

### Sendero
A sendero is a directed execution path assigned to a source agent.
It may terminate locally or point toward a target agent as the next goal boundary.

### Run
A run is the primary execution request against one feature.
Runs are retry-aware, branch-aware, richly stateful, and may be explicitly bound to an agent and sendero.

### Agent run state
Each run carries agent-execution context through linked agent-run records, including:

- host environment name
- host environment session id
- checkpoints
- status snapshots
- result/failure metadata

### Event stream
The append-only event stream exists to make state transitions explainable instead of mystical.
