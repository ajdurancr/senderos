---
title: doctor
description: "Validate the Senderos runtime, database connectivity, guardrails, and harness readiness."
---

`senderos doctor` verifies that Senderos can operate safely.

## What it checks

- configuration validity,
- configured libSQL connection health,
- directory integrity,
- managed home-directory accessibility,
- the configured harness label (not real host or model readiness),
- availability of the projects table used by the database probe.

## Examples

```bash
senderos doctor
senderos help doctor
```

## Typical use cases

Use `doctor` when:

- finishing installation,
- changing configuration,
- debugging a broken runtime,
- validating a host before scheduling dispatch cycles.

## Damaged local runtimes

`doctor` can run without an execution context. A missing, unreadable, malformed or
incomplete configuration returns the normal `{ ok: false, issues, warnings }`
report instead of preventing diagnostics from running. Invalid field names are
reported without echoing configuration contents. Managed paths must be absolute
directories; an existing file is not a healthy directory.

Inspection does not rewrite the configuration, create missing managed directories
or repair data. Restore configuration from a trusted copy or correct the named
fields, then run `doctor` again before operational commands. As with other health
reports, inspect `ok` and `issues`; an unhealthy report is valid JSON output, not a
successful runtime validation. A configured harness label does not certify a real
host, external session or model provider.

The database probe currently reads the projects table. It is not a complete schema
or database-integrity audit; a healthy result does not certify every history table.
