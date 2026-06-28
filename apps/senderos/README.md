# SenderOS

SenderOS is the orchestration engine for Senderos.

This app contains the runtime, CLI, domain model, colocated tests, canonical agent-role definitions, and supporting docs for the control plane described in the documentation site.

## Runtime model

SenderOS stores durable orchestration state in SQLite.

That state includes Senderos-owned entities such as:

- features
- tasks
- runs
- sessions
- workspaces
- events

The default executable mode uses a local SQLite database in the Senderos home directory. The configuration model also supports a Turso-compatible remote SQLite mode through a built-in database adapter.

## Important boundary

SenderOS is the factory.
It is not the coding agent and it is not an external backlog-sync engine.

SenderOS owns orchestration truth and instructions. A host agent executes coding work inside SenderOS-managed workspaces.

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

## CLI discovery

The CLI exposes machine-readable help metadata.

Examples:

```bash
senderos help
senderos help feature
senderos help feature approve
```

## What lives here

- `src/` — SenderOS runtime, CLI, services, and colocated tests
- `tests/helpers/` — shared test helpers
- `agents/` — canonical vendor-neutral agent roles in Markdown
- `adapters/` — provider-specific execution adapters
- `docs/` — methodology and architecture docs
- `templates/` — sample assets and historical references
