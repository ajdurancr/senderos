---
title: Domain Model
description: "The durable entities SenderOS stores in SQLite and how they differ from external systems and host-agent sessions."
---

SenderOS stores its orchestration model in SQLite.
Every operational state transition belongs to a SenderOS entity.

## Core rule

SenderOS entities are not the same thing as external-system entities.

A SenderOS feature is not a GitHub issue.
A SenderOS task is not a Jira ticket.
A SenderOS session is not the host-agent's entire memory.

SenderOS may reference outside systems later, but its own model stays separate.

## Core entities

### Project

A project combines:

- canonical local repository path
- canonical GitHub repository identity
- target branch
- integration mode
- inferred or stored execution commands
- health state

### Feature

A feature is the durable work item inside SenderOS.

A feature contains:

- identity
- title
- approved spec text
- original request text
- raw Gherkin contract
- parsed Gherkin metadata
- lifecycle state
- loop state
- current workspace binding
- current active run

### Task

A task is a SenderOS-owned operational unit under a feature.

The current loop uses tasks to represent phase work such as:

- implementation
- review
- mutation

### Run

A run is a single execution attempt for one task or loop phase.

A feature can have many runs over time.
Only one run may be active per feature at once.

### Session

A session is SenderOS' record of a host-agent execution handle.

The host agent owns the live session.
SenderOS owns the durable reference to it.

Typical session state includes:

- harness kind
- external session identifier when available
- status snapshot
- heartbeat timestamps
- resume metadata
- attached run id

### Workspace

A workspace is a SenderOS-managed execution directory.

SenderOS allocates it, tracks it, guards it, and retires it.

Workspace state includes:

- root path
- lock ownership
- branch identity
- cleanup state
- retention state
- associated project / feature / run / session ids

### Event

An event is the append-only history record for a meaningful state transition.

Examples:

- `project.created`
- `feature.created`
- `run.created`
- `session.completed`
- `workspace.cleaned`
- `reconciliation.completed`

## Storage model

All stateful entities live in SQLite.
Artifacts such as logs, transcripts, reports, and generated outputs live in the SenderOS home directory and are referenced from the database.

## Current lifecycle labels

Feature lifecycle today is intentionally small and explicit:

```text
awaiting_scenario_approval
-> active
-> completed | failed | blocked | canceled
```

Loop phase progression is currently:

```text
idle
-> implementation
-> review
-> mutation
-> done
```
