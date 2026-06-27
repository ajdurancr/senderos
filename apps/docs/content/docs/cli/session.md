---
title: session
description: "Inspect the host-agent execution handles Senderos records for active or historical runs."
---

`senderos session` is how operators inspect host-agent execution handles tracked by Senderos.

## Actions

- `list`
- `show <session-id>`
- `resume <session-id>`

## Examples

```bash
senderos session list --json
senderos session show session-009 --json
senderos session resume session-009
```

## Important distinction

A Senderos session record is not the host agent itself.
It is Senderos' durable reference to a host-agent execution context.
