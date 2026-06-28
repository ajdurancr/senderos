---
title: run
description: "Inspect Senderos execution attempts for loop phases and operational tasks."
---

`senderos run` exposes run history.

## Actions

- `list`
- `show <run-id>`
- `cancel <run-id>`

## Examples

```bash
senderos run list --json
senderos run show run-014 --json
senderos run cancel run-014
```

## Why it matters

A run is an execution attempt, not the feature itself.
Keeping those separate is how Senderos supports retries and recovery.
