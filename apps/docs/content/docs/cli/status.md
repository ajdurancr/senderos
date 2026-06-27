---
title: status, reconcile, and schedule-plan
description: "Operational visibility commands for current system truth, state repair, and host scheduling instructions."
---

These commands expose the system-wide operating view.

## `senderos status`

Returns a high-level summary of:

- open features,
- active loops,
- active runs,
- session health,
- workspace locks,
- pending reconciliation.

### Example

```bash
senderos status --json
```

## `senderos reconcile`

Repairs stale derived state by running Senderos' reconciliation process.

### Example

```bash
senderos reconcile --json
```

## `senderos schedule-plan`

Prints the host-job instructions needed to automate loop execution.

### Example

```bash
senderos schedule-plan --json
```

## Typical use cases

Use these commands when you need to:

- understand what the system is doing now,
- recover from session drift,
- install or update host-level scheduling.
