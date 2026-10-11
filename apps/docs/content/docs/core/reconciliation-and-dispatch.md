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
3. reading the goal's durable activations and pinned Sendero version
4. checking active ownership, completion gates, cancellation, and retry budget
5. deriving eligible activations from the validated directed graph
6. returning a decision or minimal dispatch payload

The current planning payload is:

- `goalId`
- `activationId`
- `transitionId`
- `agentId`
- `previousRunId`
- `revision`

By default, planning returns only dispatchable items. `plan --explain` and
`goal explain` also return blocked/running/terminal decisions with a reason and
next action. Empty planning output is not treated as completion.

## Dispatch model

Dispatch means consuming one planning item and persisting the state needed for one external execution attempt.

Senderos dispatches work in this order:

1. replay a matching request ID, or reject a conflicting replay
2. recompute eligibility inside one write transaction
3. reject a stale revision or mismatched optional assertions
4. create a queued run and attempt
5. persist its execution packet and unowned claim row
6. advance the execution revision

## Dispatch rules

Senderos never dispatches blindly.
It checks:

- goal state
- current run state
- agent-transition linkage
- retry conditions
- retry budget
- current execution revision
- duplicate active work
- pinned workflow validity and agent availability

If those checks fail, Senderos rejects the dispatch instead of forcing execution.
Dispatch means reservation, not host startup. A host claims the returned attempt,
records an independent session with `attempt start`, heartbeats its lease, and uses
its fencing token for updates. Planning may initialize/reconcile lifecycle state;
it never reserves or launches external execution.

## Why Senderos owns this logic

If planning lives in the host agent, orchestration rules fragment.
If dispatch lives in the host agent, persisted runtime truth becomes inconsistent across harnesses.

Both responsibilities belong in Senderos because they depend on Senderos' own model and state transitions.
