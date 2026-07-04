# Storage Model

SenderOS stores durable orchestration state in SQLite.

## Boundary

### SenderOS repository
The repository contains:

- runtime and domain code
- tests
- SenderOS documentation
- canonical agent definitions
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

## What belongs in SQLite

Structured SenderOS truth belongs in SQLite, including:

- projects
- approved specs
- feature contracts in raw Gherkin form
- parsed Gherkin metadata
- features
- runs
- run attempts
- tasks
- sessions
- workspaces
- agents
- senderos
- run-execution execution state
- PR and branch linkage
- event history

## What belongs on disk

Large runtime artifacts still belong under the Senderos home directory and are referenced from SQLite, for example:

- logs
- transcripts
- reports
- cached payloads
- temporary workspace files

## Design rule

If data describes SenderOS state transitions, ownership, workflow, project identity, features, runs, sessions, agents, senderos, or agent execution state, it belongs in SQLite.
If data is a large runtime artifact, it belongs under the Senderos home directory.
