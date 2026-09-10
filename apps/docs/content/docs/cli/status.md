---
title: status
description: "Inspect the current runtime truth: open goals, active executions, and the identifiers an operator needs for diagnosis."
---

`senderos status` exposes the system-wide operating view.

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

## Typical use cases

Use these commands when you need to:

- understand what the system is doing now
- inspect active goals, runs, and attempts
- decide which goal or run needs deeper inspection

Use [`senderos doctor`](../doctor) separately when you need to validate configuration, storage, paths, schema, or harness readiness.
