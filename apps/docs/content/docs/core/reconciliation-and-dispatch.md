---
title: Planning and Dispatch
description: "How Senderos decides what is dispatchable next and how one dispatch is persisted."
---

Planning and dispatch are core operating behaviors in Senderos.

## Planning model

Planning means selecting the next valid dispatchable work across goals.

Senderos plans work by:

1. loading current goal state
2. checking whether a goal is dispatchable now
3. inspecting the current run when present
4. checking whether a previous run is terminal
5. deriving the next transition/agent pair from persisted transitions and attempts
6. returning a minimal planning payload

The current planning payload is:

- `goalId`
- `transitionId`
- `agentId`
- `previousRunId`

By default, planning returns only dispatchable items.

## Dispatch model

Dispatch means consuming one planning item and persisting the state needed for one external execution attempt.

Senderos dispatches work in this order:

1. validate the provided ids
2. load the current goal/run state
3. validate the selected transition and source agent
4. create the run record
5. create the run attempt
6. record an optional external working path

## Dispatch rules

Senderos never dispatches blindly.
It checks:

- goal state
- current run state
- agent-transition linkage
- retry conditions

If those checks fail, Senderos rejects the dispatch instead of forcing execution.

## Why Senderos owns this logic

If planning lives in the host agent, orchestration rules fragment.
If dispatch lives in the host agent, persisted runtime truth becomes inconsistent across harnesses.

Both responsibilities belong in Senderos because they depend on Senderos' own model and state transitions.
