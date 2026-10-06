---
title: run
description: "Dispatch, inspect, and cancel Senderos runs."
---

`senderos run` is the run-state mutation and inspection surface.

## Actions

- `dispatch`
- `list`
- `show <run-id>`
- `state <goal-id>`
- `cancel <run-id>`

## Examples

```bash
senderos run dispatch --goal-id <goal-id> --request-id <stable-request-id> --expected-revision <revision>
senderos run list
senderos run show run-014
senderos run state <goal-id>
senderos run cancel run-014
```

## `dispatch`

`dispatch` atomically reserves the next Core-approved step. It does not start an
external agent session.

Pass a stable `--request-id` so an ambiguous response can be replayed without
creating another attempt. `--expected-revision` rejects stale plans. Optional
transition, agent, and previous-run IDs are assertions checked against Core's
current decision, not instructions that override it.

It returns only minimal dispatch result data such as:

- `goalId`
- `previousRunId`
- `runId`
- `attemptId`

The host must claim `attemptId` before launching real work.

## Why it matters

A run is the logical execution request, not the goal itself. Keeping runs separate
from goals and attempts supports retries and diagnostic inspection.
