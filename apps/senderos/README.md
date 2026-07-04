# SenderOS

SenderOS is the orchestration engine for Senderos.

This app contains the runtime, CLI, domain model, canonical agent-role definitions, colocated tests, and the docs that define the control-plane workflow.

## Runtime model

SenderOS stores durable orchestration state in SQLite.

The primary runtime entities are:

- projects
- features
- runs
- run attempts
- tasks
- sessions
- workspaces
- events

Approved specs and canonical Gherkin feature contracts live in SenderOS state.
Standalone feature files are not the source of truth.

## Important boundary

SenderOS is the factory.
It is not the coding agent and it is not a backlog mirror.

SenderOS owns orchestration truth and workflow state.
A host agent executes coding work inside SenderOS-managed workspaces.

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
5. SenderOS creates the feature record from that approved contract
6. human approves the executable contract for implementation
7. implementation / review / mutation / PR flow begins

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
senderos help feature approve
```

Current top-level workflow commands now include:

- `bootstrap-agent-skill`
- `project`
- `feature`
- `loop`
- `run`
- `session`
- `status` / `doctor` / `reconcile`

## First-run onboarding

SenderOS supports both direct CLI use and agent-driven operation.

Recommended first step:

```bash
senderos bootstrap-agent-skill
```

That command scaffolds a workspace-local host-agent skill and prints two next-step paths:

- an agent-driven prompt to use the skill for onboarding and ongoing SenderOS operation
- a direct CLI fallback using `senderos init ... --approve`

`bootstrap-agent-skill` prepares the operating layer.
`init` remains the runtime bootstrap primitive.

## What lives here

- `src/` — SenderOS runtime, CLI, services, and colocated tests
- `tests/helpers/` — shared test helpers
- `src/integration/` — integration test suite with flow-focused end-to-end coverage
- `agents/` — canonical vendor-neutral agent roles in Markdown
- `adapters/` — provider-specific execution adapters
- `docs/` — methodology and architecture docs
- `templates/` — historical references and examples, not live runtime truth
