# SenderOS

SenderOS is the orchestration engine for Senderos.

This app contains the runtime, CLI, domain model, tests, canonical agent-role definitions, and supporting docs for the control plane described in the documentation site.

## Runtime model

SenderOS stores durable orchestration state in SQLite.

That state includes Senderos-owned entities such as:

- features
- tasks
- runs
- sessions
- workspaces
- events

The default mode uses a local SQLite database in the Senderos home directory. The configuration model also supports a Turso-compatible remote SQLite mode.

## Important boundary

SenderOS is the factory.
It is not the coding agent and it is not an external backlog-sync engine.

SenderOS owns orchestration truth and instructions. A host agent executes coding work inside SenderOS-managed workspaces.

## Senderos home

Runtime state lives inside a dedicated Senderos home directory:

```text
~/.senderos/
  config.json
  senderos.db
  artifacts/
  logs/
  sessions/
  workspaces/
  cache/
```

## What lives here

- `src/` — SenderOS runtime, CLI, and services
- `tests/` — SenderOS verification and CLI/runtime regression coverage
- `agents/` — canonical vendor-neutral agent roles in Markdown
- `adapters/` — provider-specific execution adapters
- `docs/` — methodology and architecture docs
- `templates/` — sample assets and historical references
