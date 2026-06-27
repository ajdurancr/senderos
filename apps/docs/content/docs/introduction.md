---
title: Introduction
description: "What Senderos is, what it owns, and the operating model behind the system."
---

Senderos is the orchestration system for a loop-engineering software factory.

It does not write application code itself. It keeps the factory coherent.

Senderos owns the operational truth of the system:

- which features exist,
- what state each feature is in,
- which loop is active,
- which host-agent sessions belong to that loop,
- which workspace is reserved for that work,
- what happened during execution,
- what still needs reconciliation.

## What Senderos is

Senderos is a CLI-first system with an internal operating layer.

The CLI is the public interface. Under it lives Senderos' own operating logic: dedicated internal agents and deterministic services that know how Senderos works, how its state is modeled, how its database is queried, how work is dispatched, and how runs are reconciled.

The host agent never needs to know those internal roles directly. The host agent talks to `senderos` through the CLI. Senderos decides which internal operating role is responsible.

## What Senderos is not

Senderos is not:

- a smart prompt,
- a giant external skill,
- a backlog sync engine for v1,
- a coding agent,
- a hidden integration layer that directly manipulates every external service.

Senderos is the factory orchestrator.

The host agent is the execution engine that performs code changes inside the workspaces Senderos manages.

## What Senderos owns

Senderos owns:

- feature records,
- Senderos tasks,
- loop state,
- run state,
- session state,
- workspace allocation state,
- event history,
- configuration,
- reconciliation,
- dispatch decisions,
- host-agent instructions for execution.

## What Senderos does not own

Senderos does not own:

- source-system tickets such as GitHub issues, Jira tickets, or Linear issues,
- the host agent's prompt/runtime internals,
- the implementation diff itself,
- scheduling infrastructure on the host,
- outbound service adapters beyond harness communication.

Those things may be referenced by Senderos, but they are not Senderos state.

## The core distinction that matters

There are two separate realities:

1. **Senderos state** — durable orchestration truth stored in Senderos.
2. **Host-agent session state** — transient execution context owned by the host environment.

Senderos records the second one, but it is never replaced by it.

That separation is the reason a loop can survive session death, shell crashes, or a switch from one host agent to another.
