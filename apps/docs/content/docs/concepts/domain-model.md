---
title: Domain Model
description: "The durable entities Senderos stores in SQLite and how they differ from external systems and host-agent sessions."
---

Senderos stores its orchestration model in SQLite.
Every operational state transition belongs to a Senderos entity.

## Core rule

Senderos entities are not the same thing as external-system entities.

A Senderos feature is not a GitHub issue.
A Senderos task is not a Jira ticket.
A Senderos session is not the host-agent's entire memory.

Senderos may reference outside systems later, but its own model stays separate.

## Core entities

### Feature

A feature is the main business work item inside Senderos.

A feature contains:

- identity,
- title,
- problem statement,
- executable feature contract,
- lifecycle state,
- loop state,
- completion criteria,
- current workspace binding,
- current active run.

### Task

A task is a Senderos-owned operational unit under a feature.

Examples:

- define feature contract,
- generate executable scenarios,
- run TDD cycle,
- perform review pass,
- run mutation gate,
- reconcile workspace,
- finalize outcome package.

Tasks are Senderos tasks, not external backlog records.

### Run

A run is a single execution attempt for one task or loop phase.

A feature can have many runs.
A failed run does not imply a failed feature.

### Session

A session is Senderos' record of a host-agent execution handle.

The host agent owns the live session.
Senderos owns the durable reference to it.

Typical session state includes:

- harness kind,
- external session identifier,
- status snapshot,
- heartbeat timestamps,
- resume metadata,
- attached run id.

### Workspace

A workspace is a Senderos-managed execution directory.

Senderos allocates it, tracks it, guards it, and retires it.

Workspace state includes:

- root path,
- lock ownership,
- branch identity,
- cleanup state,
- retention state,
- associated feature/run/session ids.

### Event

An event is the append-only history record for a meaningful state transition.

Examples:

- feature.created,
- feature.loop_started,
- run.started,
- run.completed,
- session.stale,
- workspace.locked,
- workspace.released,
- reconciliation.completed.

## Storage model

All stateful entities live in SQLite.
Artifacts such as logs, transcripts, reports, and generated outputs live in the Senderos home directory and are referenced from the database.

## Current lifecycle labels

```text
defined
-> ready_contract
-> active_implementation
-> verifying_review
-> verifying_mutation
-> completed
-> failed | canceled
```

The exact labels are implementation-level details, but the key requirement remains the same: every transition must be explicit, queryable, and enforceable.
