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
- SenderOS is the system of record for approved specs, Gherkin feature contracts, lifecycle state, and event history.
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

### Run
A run is one execution request against one feature.
Runs are retry-aware, branch-aware, and richly stateful.

### Event stream
The append-only event stream exists to make state transitions explainable instead of mystical.
