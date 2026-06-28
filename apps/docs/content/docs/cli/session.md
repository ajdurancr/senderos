---
title: session
description: "Inspect the host-agent execution handles SenderOS records for active or historical runs."
---

`senderos session` is how operators inspect host-agent execution handles tracked by SenderOS.

## Actions

- `list`
- `show <session-id>`
- `resume <session-id>`

## Examples

```bash
senderos session list
senderos session show session-009
senderos session resume session-009
```

## What `resume` returns today

A session resume response currently includes:

- the stored session record
- the SenderOS-side `resumeCommand`
- the harness kind
- a `launchCommand` when SenderOS has enough information to propose one

For Codex-driven local flows, the launch metadata currently surfaces a proposed command shape such as `codex exec` inside the allocated workspace.

## Important distinction

A SenderOS session record is not the host agent itself.
It is SenderOS' durable reference to a host-agent execution context.
