---
title: Worker and Scheduling
description: "How host-driven automation fits the current Senderos plan/dispatch model."
---

Senderos can be automated by a host agent, but it does not own the host scheduler.

## Current model

The host agent typically loops like this:

1. call `senderos status`
2. call `senderos plan`
3. dispatch each returned item separately with `senderos run dispatch ...`
4. execute the real work asynchronously in separate host sessions
5. repeat later

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
Senderos keeps orchestration portable by exposing plan/dispatch/state surfaces instead of directly taking ownership of the scheduler.
