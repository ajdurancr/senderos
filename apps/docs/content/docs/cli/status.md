---
title: status and doctor
description: "Operational visibility commands for current runtime truth and health validation."
---

These commands expose the system-wide operating view.

## `senderos status`

Returns a high-level summary of:

- open features
- active supervisions
- active runs
- pending tasks
- stale session ids
- orphaned workspace ids
- active feature/run/session/workspace identifiers

### Example

```bash
senderos status
```

`status` is report-only.
It does not mutate runtime state.

## `senderos doctor`

Validates the configured runtime and reports whether the home/database setup is healthy.

### Example

```bash
senderos doctor
```

## Typical use cases

Use these commands when you need to:

- understand what the system is doing now
- inspect stale sessions or orphaned workspaces
- validate runtime health before relying on planning/dispatch output
