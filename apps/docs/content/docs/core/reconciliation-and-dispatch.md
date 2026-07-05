---
title: Planning and Dispatch
description: "How Senderos decides what is dispatchable next and how one dispatch is persisted."
---

Planning and dispatch are core operating behaviors in Senderos.

## Planning model

Planning means selecting the next valid dispatchable work across features.

Senderos plans work by:

1. loading current feature state
2. checking whether a feature is dispatchable now
3. inspecting the current run when present
4. checking whether an external session is still active
5. deriving the next sendero/agent pair from persisted sendero and run-execution state
6. returning a minimal planning payload

The current planning payload is:

- `featureId`
- `senderoId`
- `agentId`
- `previousRunId`

By default, planning returns only dispatchable items.

## Dispatch model

Dispatch means consuming one planning item and persisting the state needed for one external execution session.

Senderos dispatches work in this order:

1. validate the provided ids
2. load the current feature/run state
3. allocate or reuse the correct sendero step state
4. allocate a workspace when needed
5. create the run record
6. create the session record
7. create the run-execution record
8. transition the feature state

## Dispatch rules

Senderos never dispatches blindly.
It checks:

- feature state
- current run state
- session state
- sendero linkage
- retry conditions
- workspace ownership

If those checks fail, Senderos rejects the dispatch instead of forcing execution.

## Why Senderos owns this logic

If planning lives in the host agent, orchestration rules fragment.
If dispatch lives in the host agent, persisted runtime truth becomes inconsistent across harnesses.

Both responsibilities belong in Senderos because they depend on Senderos' own model and state transitions.
