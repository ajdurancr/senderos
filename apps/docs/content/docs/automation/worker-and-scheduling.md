---
title: Worker and Scheduling
description: "Operate an external host loop and run a deterministic process-separated adapter without API keys."
---

Senderos coordinates durable work. Your host owns actual workers and scheduling.
There is no Senderos daemon, model runner, checkout synchronizer, or built-in cron.

## The simplest local host simulation

From the source repository, with Bun and dependencies installed:

```bash
bun run simulate:host --output .tmp/external-host-report.json
bun run simulate:host --keep --output .tmp/external-host-report.json
```

The first command cleans up its isolated runtime; `--keep` retains it for inspection.
Both emit JSON and fail nonzero when an assertion fails. The same contract is part
of the CLI integration test suite.

The controller launches the real CLI in separate processes and starts independent
worker processes. Three simulated tool/machine contexts use different homes and
workspace paths while sharing one local libSQL file. Workers exchange packets and
results over standard I/O; no worker needs another worker's files. No API key or
model call is involved.

The scenarios cover capability/workspace failures, claim and dispatch contention,
replay/fencing, conditional backedges, activation budgets, fan-out and explicit
joins, evidence/review, publication pinning, real process termination, lease expiry,
active/missing/finished/unknown recovery observations, and cancellation acknowledgement.

This proves local process-separated coordination on one machine. It does not
certify a real Codex/Cursor adapter, separate physical machines, remote libSQL,
network partitions, security isolation, or exactly-once external effects.

## One real host tick

1. Register the concrete tool/machine host with its verified capabilities.
2. Obtain a project workspace grant and declare the verified host-local path.
3. Discover assignments and inspect `plan --explain` / `goal explain`.
4. Reserve a Core-selected activation with a stable request ID and revision.
5. Run preflight, claim, and persist the fence before launching.
6. Deduplicate launches by attempt ID; open an independent worker session.
7. Record the actual session, distinct parent, and local path with `attempt start`.
8. Heartbeat, honor cancellation, and return a result with the current fence.
9. Ask Core again. It chooses routes, waits for joins/gates, and determines completion.

The executable example lives in `examples/external-host`, with its scenario driver
at `scripts/external-host-simulation.ts`. Replace its process launcher and inspector
with your harness's APIs; keep the control-plane sequence. Do not implement a
second graph interpreter in the host.

## Recovery is inspection, not blind retry

An expired lease does not prove that the worker stopped. Inspect its actual session
and use `attempt reconcile` to record:

- `active`: reclaim eligible ownership and retain the same existing session
- `finished`: recover the result without launching the action again
- `missing`: confirm the old process stopped, then explicitly abandon before retry
- `unknown`: leave blocked until inspection or an operator resolves the uncertainty

`attempt resume` returns recorded information and never executes its resume command.
Check current ownership, session, and local workspace before using that information.
Claims fence database reports; external side effects need host-side deduplication.

## Scheduling stays external

Your host may run the tick manually, on a timer, or through its own scheduler.
Senderos does not install that scheduler or claim a missing host capability.
For multiple machines, provision each workspace independently and use a supported
shared database. A portable workspace reference does not make a laptop path valid
on a VPS.
