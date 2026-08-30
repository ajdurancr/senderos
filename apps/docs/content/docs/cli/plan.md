---
title: plan
description: "Return the next dispatchable work items across Senderos without mutating execution state."
---

`senderos plan` is the global planning command.

It does **not** dispatch work.
It returns only the next dispatchable items by default.

## Actions

- top-level only: `senderos plan`

## Examples

```bash
senderos plan
senderos plan --goal-status active
senderos plan --goal-status active --goal-status failed
senderos help plan
```

## Output contract

Each planning item currently returns only:

- `goalId`
- `transitionId`
- `agentId`
- `previousRunId`

This is intentionally minimal.
The host agent uses those ids to decide whether to call `senderos run dispatch ...`.

## Planning rules

By default, Senderos only returns dispatchable items.
That means it omits work that is still running or otherwise not ready for dispatch.

A goal can be dispatchable when:

- it is active and has no current run
- its previous run succeeded and the next agent transition can be dispatched
- its previous run failed and a retry is valid

## Why there is no per-goal plan command

Planning is intentionally global.
The host agent asks Senderos what is dispatchable now, then dispatches each item separately.
