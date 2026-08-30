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
senderos run dispatch --goal-id <goal-id> --transition-id <transition-id> --agent-id <agent-id> --working-path /repo/path
senderos run dispatch --goal-id <goal-id> --transition-id <transition-id> --agent-id <agent-id> --previous-run-id <run-id>
senderos run list
senderos run show run-014
senderos run state <goal-id>
senderos run cancel run-014
```

## `dispatch`

`dispatch` is the forward-dispatch mutation command.

It consumes ids returned by `senderos plan` and creates the persisted runtime state needed for one external execution attempt.

It returns only minimal dispatch result data such as:

- `goalId`
- `previousRunId`
- `runId`
- `attemptId`

The host agent decides how to use that result to launch real work.
Senderos does not execute the coding task itself.

## Why it matters

A run is the logical execution request, not the goal itself. Keeping runs separate
from goals and attempts supports retries and diagnostic inspection.
