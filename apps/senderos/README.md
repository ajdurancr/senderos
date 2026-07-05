# SenderOS

SenderOS is the orchestration engine for Senderos.

This app contains the runtime, CLI, domain model, canonical agent-role definitions, colocated tests, and the docs that define the control-plane workflow.

## Runtime model

SenderOS stores durable orchestration state in SQLite.

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

Approved specs and canonical Gherkin feature contracts live in SenderOS state.
Standalone feature files are not the source of truth.

## Important boundary

SenderOS is the factory.
It is not the coding agent and it is not a backlog mirror.

SenderOS owns orchestration truth and workflow state.
A host agent executes coding work inside SenderOS-managed workspaces.

## Senderos home

In the current repository-local workflow, runtime state lives inside a dedicated SenderOS home directory such as:

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
5. SenderOS creates the feature record from that approved contract
6. human approves the executable contract for implementation
7. SenderOS plans the next dispatchable run
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

- `src/` — SenderOS runtime, CLI, services, and colocated tests
- `tests/helpers/` — shared test helpers
- `src/integration/` — integration test suite with flow-focused end-to-end coverage
- `agents/` — canonical vendor-neutral agent roles in Markdown, used as bootstrap seed input
- `adapters/` — provider-specific execution adapters
- `docs/` — methodology and architecture docs
- `templates/` — historical references and examples, not live runtime truth
