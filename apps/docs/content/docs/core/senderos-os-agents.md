---
title: Senderos Operating Agents
description: "The internal agents that operate Senderos and how their responsibilities differ from the host agent."
---

Senderos includes its own internal operating agents.
These are not exposed as first-class concepts to the host agent.

The CLI invokes them as part of Senderos' operating layer.

## Why they exist

Senderos has to do more than persist rows.
It has to enforce consistent operations:

- feature state transitions,
- sendero progression,
- planning and dispatch safety,
- workspace ownership,
- configuration validity,
- harness communication requirements.

Those responsibilities are operational, not product-code implementation work.

## Internal operating roles

### Feature operator

Owns:

- feature lifecycle transitions,
- feature validation,
- feature-to-sendero conversion,
- feature readiness checks.

### Execution operator

Owns:

- sendero step progression,
- run state sequencing,
- review and mutation gates,
- selecting the next required execution step.

### Dispatch operator

Owns:

- workspace reservation,
- run creation,
- host-agent instruction generation,
- run-execution record initialization.

### Recovery operator

Owns:

- stale session recovery,
- abandoned workspace detection,
- incomplete run repair,
- derived-state reconciliation.

### Configuration operator

Owns:

- config validation,
- database connectivity,
- local-vs-Turso setup checks,
- home-directory integrity checks.

## Where the responsibility lives

These responsibilities live in Senderos, not in the host agent.

The host agent is told what to do.
It is not the source of truth for how Senderos works.

This separation is what keeps Senderos predictable and consistent across harnesses.
