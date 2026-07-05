---
title: run
description: "Dispatch, inspect, and cancel Senderos runs."
---

`senderos run` is the run-state mutation and inspection surface.

## Actions

- `dispatch`
- `list`
- `show <run-id>`
- `state --feature-id <feature-id>`
- `cancel <run-id>`

## Examples

```bash
senderos run dispatch --feature-id <feature-id> --sendero-id <sendero-id> --agent-id <agent-id>
senderos run dispatch --feature-id <feature-id> --sendero-id <sendero-id> --agent-id <agent-id> --previous-run-id <run-id>
senderos run list
senderos run show run-014
senderos run state --feature-id feature-001
senderos run cancel run-014
```

## `dispatch`

`dispatch` is the forward-dispatch mutation command.

It consumes ids returned by `senderos plan` and creates the persisted runtime state needed for one external execution session.

It returns only minimal dispatch result data such as:

- `featureId`
- `previousRunId`
- `runId`
- `runExecutionId`
- `sessionId`

The host agent decides how to use that result to launch real work.
Senderos does not execute the coding task itself.

## Why it matters

A run is the logical execution request, not the feature itself.
Keeping runs separate from features and sessions is how Senderos supports retries, stateful dispatch, and diagnostic inspection.
