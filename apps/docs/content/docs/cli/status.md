---
title: status and doctor
description: "Operational visibility commands for current runtime truth and health validation."
---

These commands expose the system-wide operating view.

## `senderos status`

Returns a high-level summary of:

- open goals
- active goals in flight
- active runs
- active attempt ids
- active goal and run identifiers

### Example

```bash
senderos status
```

`status` is report-only.
It does not mutate runtime state.

## `senderos doctor`

Validates the configured runtime and reports whether the home/libSQL setup is healthy.

### Example

```bash
senderos doctor
```

## Typical use cases

Use these commands when you need to:

- understand what the system is doing now
- inspect active goals, runs, and attempts
- validate runtime health before relying on planning/dispatch output
