---
title: Reconciliation and Dispatch
description: "How Senderos decides what to run next, how it recovers drift, and how the loop stays coherent over time."
---

Reconciliation and dispatch are core operating behaviors in Senderos.
They are not side topics.

## Dispatch model

Dispatch means selecting the next valid unit of loop work and preparing the host agent to execute it.

Senderos dispatches work in this order:

1. load the current Senderos feature state,
2. confirm the feature is dispatchable,
3. load the active loop state,
4. confirm workspace ownership and lock state,
5. identify the next loop phase,
6. generate host-agent instructions,
7. record a run,
8. bind or create a session record,
9. transition the feature and loop state.

### Dispatch rules

Senderos never dispatches blindly.
It checks:

- feature state,
- run state,
- session state,
- workspace lock state,
- guardrail violations,
- retry policy,
- whether another active loop already owns the workspace.

If any of those checks fail, Senderos records the block instead of forcing execution.

## Reconciliation model

Reconciliation is how Senderos restores truth when the host-agent world drifts.

Drift happens when:

- a host session dies,
- a shell closes,
- a machine restarts,
- a run ends without reporting back,
- a workspace remains locked after failure,
- the host agent completed work but Senderos has stale state.

Senderos reconciles by:

1. loading open features, runs, sessions, and workspaces,
2. checking their expected invariants,
3. querying harness state when available,
4. comparing expected state vs observed state,
5. repairing derived state,
6. emitting reconciliation events,
7. either resuming the loop or marking manual intervention required.

## Reconciliation flow diagram

```text
open records
  -> inspect feature/run/session/workspace invariants
  -> query host-agent harness status
  -> compare expected vs observed truth
  -> repair derived state
  -> unlock / retain / resume / fail
  -> emit events
  -> return updated system status
```

## Why Senderos must own this logic

If reconciliation lives in the host agent, the system becomes session-dependent.
If dispatch lives in the host agent, the orchestration rules fragment across harnesses.

Both responsibilities belong in Senderos because they depend on Senderos' own model and state transitions.
