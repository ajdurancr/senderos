# Senderos

Senderos is the orchestration engine for Senderos.

This app contains the runtime, CLI, domain model, canonical agent-role definitions, colocated tests, and the docs that define the control-plane workflow.

## Runtime model

Senderos stores durable orchestration state in SQLite.

The primary runtime entities are:

- projects
- features
- runs
- tasks
- sessions
- workspaces
- agents
- senderos
- run executions
- events

Approved specs and canonical Gherkin feature contracts live in Senderos state.
Standalone feature files are not the source of truth.

## Important boundary

Senderos is the factory.
It is not the coding agent and it is not a backlog mirror.

Senderos owns orchestration truth and workflow state.
A host agent executes coding work inside Senderos-managed workspaces.

## Senderos home

In the current repository-local workflow, runtime state lives inside a dedicated Senderos home directory such as:

```text
<workspace>/.senderos/
  config.json
  senderos.db
  artifacts/
  logs/
  sessions/
  workspaces/
  cache/
```

## Workflow shape

The strict path is now:

1. user intent
2. `spec_partner` refines the spec
3. human approves the spec
4. `gherkin_author` emits raw Gherkin + structured metadata
5. Senderos creates the feature record from that approved contract
6. human approves the executable contract for implementation
7. Senderos plans the next dispatchable run
8. the host agent dispatches one run at a time with `senderos run dispatch ...`
9. implementation / review / mutation / PR flow continues through sendero steps

See:

- `docs/workflow.md`
- `docs/state-model.md`
- `docs/storage-model.md`

## CLI discovery

The CLI exposes machine-readable help metadata.

Examples:

```bash
senderos help
senderos help project
senderos help run dispatch
senderos help run dispatch --omit-agent-description
```

Current top-level workflow commands now include:

- `project`
- `feature`
- `agent`
- `sendero`
- `plan`
- `run`
- `session`
- `status` / `doctor`

## What lives here

- `src/` — Senderos runtime, CLI, services, and colocated tests
- `tests/helpers/` — shared test helpers
- `src/integration/` — integration test suite with flow-focused end-to-end coverage
- Built-in system-agent examples live in `apps/docs/content/docs/reference/system-agents/`
- `db-seeds/agents/` — the single runtime seed source for built-in agent records
- `adapters/` — provider-specific execution adapters
- `docs/` — methodology and architecture docs
