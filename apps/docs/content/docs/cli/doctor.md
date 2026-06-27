---
title: doctor
description: "Validate the Senderos runtime, database connectivity, guardrails, and harness readiness."
---

`senderos doctor` verifies that Senderos can operate safely.

## What it checks

- configuration validity,
- local SQLite or Turso connectivity,
- directory integrity,
- workspace root accessibility,
- harness readiness,
- schema availability.

## Examples

```bash
senderos doctor
senderos doctor --json
```

## Typical use cases

Use `doctor` when:

- finishing installation,
- changing configuration,
- debugging a broken runtime,
- validating a host before scheduling loop execution.
