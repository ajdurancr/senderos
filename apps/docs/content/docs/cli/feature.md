---
title: feature
description: "Create, inspect, update, approve, and manage Senderos features."
---

`senderos feature` is the main entry point for feature state.

## Actions

- `create`
- `list`
- `show`
- `update`
- `approve`
- `cancel`

## Examples

```bash
senderos feature create --title "Add billing portal"
senderos feature list --json
senderos feature show feature-001 --json
senderos feature approve feature-001
```

## Typical use cases

Use `feature` to:

- register new work,
- inspect current feature truth,
- update the feature contract,
- mark a feature ready for loop execution.

## Important distinction

These are Senderos features.
They are not GitHub issues, Jira tickets, or Linear tasks.
