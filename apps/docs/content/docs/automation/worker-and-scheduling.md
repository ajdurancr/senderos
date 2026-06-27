---
title: Loop Execution and Scheduling
description: "How Senderos starts the loop manually, how it emits scheduling instructions, and how host-driven automation fits in."
---

Senderos can advance the factory loop in two ways:

- manual invocation through the CLI,
- host-driven scheduling created by the host agent from Senderos instructions.

## Manual loop execution

Manual execution is always available.

Examples:

```bash
senderos loop start <feature-id>
senderos loop resume <feature-id>
senderos loop tick <feature-id>
senderos reconcile
```

This matters because not every host environment supports cron or scheduled jobs.

## Scheduling model

Senderos does not create cron jobs itself.
It does not own that host capability.

Instead, Senderos emits the scheduling plan the host agent should install.
The host agent creates the real scheduled job in its own environment.

A scheduling plan contains:

- the command to execute,
- the cadence,
- required environment variables,
- guardrail notes,
- expected outputs,
- recovery instructions.

## Scheduling flow

```text
senderos schedule plan
  -> senderos emits host-job instructions
  -> host agent installs the real job
  -> scheduled job runs `senderos ...`
  -> senderos advances or reconciles loop state
```

## Why scheduling stays outside Senderos

Scheduling infrastructure belongs to the host environment.
Senderos keeps orchestration portable by describing what should be scheduled instead of directly taking ownership of the scheduler.

## Safe loop automation

Loop automation is still governed by Senderos state and guardrails.
A scheduled invocation does not bypass:

- workspace locks,
- feature-state rules,
- reconciliation checks,
- failure boundaries.
