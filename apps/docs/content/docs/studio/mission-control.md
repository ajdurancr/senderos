---
title: Mission Control
description: "The current Studio surface for seeing operational truth, starting and stopping work, retrying failures, and reviewing execution evidence."
---

Senderos Studio is the human-facing operational surface over `@senderos/core`. It is designed as Mission Control: a place to understand what needs attention and make bounded lifecycle decisions, not a visual workflow builder.

## What exists today

The current Studio foundation consumes the same runtime and database as the CLI. Its server facade exposes:

- a system overview of projects, goals, runs, and attempts;
- queues for dispatchable goals, blocked goals, active runs, failed attempts, and stale attempts;
- pending evidence reviews;
- a goal-level view that combines its run state, agents, transitions, and related event history;
- actions to activate and start a goal, stop an execution, and retry a failed execution.

This is a working operational foundation. The UX is still early and will continue to grow around the lifecycle already present in core.

## Decision queues

Mission Control organizes runtime data around questions an operator must answer:

| Queue | Operator question |
| --- | --- |
| Dispatchable | What is ready to start? |
| Active runs | What is running now? |
| Failed attempts | What needs diagnosis or retry? |
| Stale attempts | What claims to be running but has no heartbeat? |
| Reviews | Which execution has evidence awaiting a decision? |
| Blocked goals | What requires human context or intervention? |

## Run Studio locally

From the Senderos monorepo:

```bash
bun install
SENDEROS_HOME=/absolute/path/to/.senderos bun run dev:studio
```

`SENDEROS_HOME` selects the same runtime home used by the CLI. Without it, Studio uses the default home resolution from core.

## Review is a record, not an external action

An operator review can be `pending`, `approved`, `changes_requested`, or `rejected`. It is persisted alongside attempt evidence and mirrored into the append-only event history.

Approval does not push a branch, merge a pull request, deploy software, or operate a host session. Those actions remain the responsibility of the host environment and its own permission model.

## Current boundary

Studio is not yet a complete product UI for every CLI capability. For precise inspection and automation, the CLI remains the primary public operating interface. Studio adds a decision-oriented view over the same source of truth rather than creating a separate one.
