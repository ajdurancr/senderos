# Storage Model

SenderOS stores durable orchestration state in SQLite.

## Boundary

### SenderOS repository
The repository contains:
- runtime and domain code
- tests
- SenderOS documentation
- templates and examples

The repository does **not** contain live SenderOS runtime state as the canonical persistence model.

### SenderOS runtime state
Real orchestration state lives in the Senderos home directory, with SQLite as the authority for structured state:

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

## Database modes

SenderOS supports:
- local SQLite by default
- Turso-compatible remote SQLite configuration as the supported remote mode

The schema stays consistent across both modes.

## Artifact model

Structured state lives in SQLite.
Large artifacts such as logs, transcripts, reports, and cached payloads live under the Senderos home directory and are referenced from the database.

## Design rule

If data describes SenderOS state transitions, ownership, runs, or sessions, it belongs in SQLite.
If data is a large runtime artifact, it belongs under the Senderos home directory.
