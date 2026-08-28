# Architecture — Agent transitions Runtime Boundaries

## Monorepo shape

- `apps/agent transitions` — orchestration runtime and domain logic
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

- Agent transitions owns orchestration/runtime concerns.
- Senderos is the system of record for approved specs, specification contract goal contracts, lifecycle state, event history, agent definitions, agent transition assignments, run attempt metadata, and planning/dispatch state.
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

### Goal
A goal is the durable work container.
It stores approved spec context plus the canonical specification contract contract and later gains branch/PR linkage.

### Agent
An agent is a first-class runtime executor.
Built-in agents are seeded from JSON records under `db-seeds/agents/` at init time and then managed as runtime records. Human-readable examples of those built-in agents live in the docs app under `apps/docs/content/docs/reference/system-agents/`.
The docs app pages under `apps/docs/content/docs/reference/system-agents/` remain the human-readable examples of those roles.

### Agent transition
A agent transition is the persisted path a goal follows.
It is assigned to a source agent and may point toward a target agent as the next goal boundary.

### Run
A run is the primary execution request against one goal.
Runs are retry-aware, branch-aware, richly stateful, and may be explicitly bound to an agent and agent transition through plan output and dispatch input.

### Agent transition Supervisor
A Agent transition Supervisor is an ephemeral runtime concern, not a persisted model.
It reads goal/run/run attempt state, decides whether the next dispatch is possible, and advances the agent transition step only through existing persisted entities.

### Run attempt state
Each run carries concrete execution context through linked `run_attempts`, including:

- host environment name
- host environment run attempt id
- checkpoints
- status snapshots
- result/failure metadata

### Host-agent contract
The host agent interacts with Agent transitions in two phases:

1. `senderos plan` returns minimal dispatchable items.
2. `senderos run dispatch ...` consumes one planning item and creates the persisted runtime state for one external execution run attempt.

Agent transitions does not perform the real coding work.
The host agent does.

### Event stream
The append-only event stream exists to make state transitions explainable instead of mystical.
