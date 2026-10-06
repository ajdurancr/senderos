---
title: Worker and Scheduling
description: "How host-driven automation fits the current Senderos plan/dispatch model."
---

Senderos can be automated by a host agent, but it does not own the host scheduler.

## Current model

The host agent typically runs in this cycle:

1. call `senderos status`
2. call `senderos plan --explain` (or `plan` for ready work only)
3. dispatch with a stable request ID and the returned revision
4. claim the attempt and persist its fencing token
5. launch the external session, heartbeat, and report its terminal result
6. ask Core again after a delay or trigger

This keeps scheduling logic in the host environment while preserving a deterministic Senderos control plane.

## Manual operation

Manual invocation is always available.

Examples:

```bash
senderos status
senderos plan --explain
senderos run dispatch --goal-id <goal-id> --request-id <stable-id> --expected-revision <revision>
senderos attempt claim <attempt-id> --owner-id <stable-host-id>
```

## Scheduling model

Senderos does not create cron jobs itself.
It does not own that host capability.

If the host environment supports scheduling, the host agent can install its own job that periodically runs the Senderos CLI.
A typical scheduled flow is simply:

```text
host scheduler
  -> senderos status
  -> senderos plan
  -> host dispatches and claims returned items
  -> host heartbeats and reports results
```

The lease prevents two hosts from owning one attempt, but it cannot guarantee
exactly-once external side effects. Reconcile ambiguous launches and expired
sessions before reclaiming; never treat lease expiry as proof a process stopped.

## Why scheduling stays outside Senderos

Scheduling infrastructure belongs to the host environment.
Senderos keeps orchestration portable by exposing plan/dispatch/state surfaces instead of directly owning the scheduler.
