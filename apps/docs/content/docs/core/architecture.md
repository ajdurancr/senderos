---
title: Architecture
description: "The production architecture for Senderos: CLI, internal operating layer, SQLite state, and host-agent orchestration."
---

Senderos has four architectural layers.

## 1. CLI surface

The `senderos` CLI is the only public control surface.

Humans and host agents both use it.
The CLI exposes:

- state inspection,
- feature lifecycle operations,
- loop operations,
- configuration,
- reconciliation,
- status and reporting,
- machine-readable outputs.

The host agent knows Senderos through this interface only.
It does not need awareness of Senderos' internal operating roles.

## 2. Senderos operating layer

Inside Senderos lives an opinionated operating layer.

This layer is made of internal agents and deterministic services dedicated to operating Senderos itself.
These internal roles know:

- the Senderos data model,
- the SQLite schema,
- loop transitions,
- reconciliation rules,
- dispatch rules,
- configuration rules,
- workspace guardrails,
- harness communication requirements.

The CLI invokes this layer.
The host agent never does.

## 3. Persistent state layer

Senderos stores all orchestration state in SQLite.

By default, Senderos uses a local SQLite database in the Senderos home directory.
It also supports SQLite-compatible remote services, with Turso as the supported remote option.

This keeps the data model consistent while allowing different deployment modes.

## 4. Host-agent execution layer

Senderos does not edit product code itself.
Instead, it instructs a host agent to execute work inside a Senderos-managed workspace.

The host agent may be OpenClaw, Codex, Claude Code, or another supported harness.
Harness support exists only to let Senderos communicate with the host agent reliably.

## Architecture diagram

```text
+---------------------------+
| human / automation / CLI  |
+-------------+-------------+
              |
              v
+---------------------------+
| senderos CLI              |
| commands + JSON output    |
+-------------+-------------+
              |
              v
+---------------------------+
| senderos operating layer  |
| internal agents + rules   |
+------+------+-------------+
       |      |
       |      +----------------------+
       |                             |
       v                             v
+-------------+               +-------------------+
| SQLite/Turso|               | workspace manager |
| state store |               | guardrails        |
+------+------+               +---------+---------+
       |                                |
       +-------------------+------------+
                           |
                           v
                 +----------------------+
                 | host agent harness    |
                 | executes code changes |
                 +----------------------+
```

## Why there are no generic service adapters in v1

Senderos does not build direct adapters for GitHub, Jira, Linear, notifications, or repository hosting in v1.

When external work is required, Senderos tells the host agent exactly what to do.
That keeps Senderos focused on orchestration instead of re-implementing capabilities the host agent likely already has.

The only adapter family inside Senderos is the harness adapter family used to communicate with supported host-agent environments.
