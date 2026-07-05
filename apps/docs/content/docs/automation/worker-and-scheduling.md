---
title: Worker and Scheduling
description: "How host-driven automation fits the current Senderos plan/dispatch model."
---

Senderos can be automated by a host agent, but it does not own the host scheduler.

## Current model

The host agent typically runs in this cycle:

1. call `senderos status`
2. call `senderos plan`
3. dispatch each returned item with `senderos run dispatch ...`
4. execute the real work asynchronously in separate host sessions
5. return later and repeat after a delay or trigger

This keeps scheduling logic in the host environment while preserving a deterministic Senderos control plane.

## Manual operation

Manual invocation is always available.

Examples:

```bash
senderos status
senderos plan
senderos run dispatch --feature-id <feature-id> --sendero-id <sendero-id> --agent-id <agent-id>
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
  -> host dispatches returned items
```

## Why scheduling stays outside Senderos

Scheduling infrastructure belongs to the host environment.
Senderos keeps orchestration portable by exposing plan/dispatch/state surfaces instead of directly owning the scheduler.
