---
title: feature
description: "Create, inspect, update, approve, and manage Senderos features."
---

`senderos feature` is the main entry point for feature state.

## Actions

- `create`
- `list`
- `show <feature-id>`
- `update <feature-id>`
- `approve <feature-id>`
- `cancel <feature-id>`

## Examples

```bash
senderos feature create --title "Add billing portal"
senderos feature list
senderos feature show feature-001
senderos feature approve feature-001
senderos help feature approve
```

## Typical use cases

Use `feature` to:

- register new work,
- inspect current feature truth,
- update the feature contract,
- mark a feature ready for contract-phase loop execution.

## Important distinction

These are Senderos features.
They are not GitHub issues, Jira tickets, or Linear tasks.
