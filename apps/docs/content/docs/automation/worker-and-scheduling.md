---
title: Worker and Scheduling
description: "How Senderos should poll, reconcile, and dispatch work without turning into an unsafe autonomous mess."
---

## Worker model

Instead of thinking in terms of “loop through tasks forever,” Senderos should expose a worker model.

Examples:

```bash
senderos worker tick
senderos worker run --once
senderos worker daemon
senderos worker reconcile
```

A worker can:

- poll configured sources,
- refresh ready or blocked work,
- reconcile active runs,
- queue eligible features,
- dispatch work when policy allows,
- emit events and status updates.

## Scheduling model

Schedules should be represented in Senderos state, not hidden only in an external cron system.

That allows Senderos to answer:

- which schedules exist,
- what they are supposed to do,
- when they last ran,
- whether they are paused,
- which backend is executing them.

## Backend examples

Senderos can support several scheduling backends:

- local cron,
- OpenClaw cron,
- internal daemon,
- external job runners.

The desired schedule definition should stay consistent even if the backend changes.

## Safe autonomy

Start with low-risk automation:

- polling,
- status refresh,
- stale-run detection,
- queue maintenance.

Move to auto-dispatch only when policy is clear. Otherwise the system will happily create duplicate work and surprise branches. Nobody needs that nonsense.
