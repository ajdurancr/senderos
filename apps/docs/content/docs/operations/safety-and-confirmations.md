---
title: Safety and Guardrails
description: "The hard boundaries that keep Senderos contained, consistent, and safe to operate through a host agent."
---

Senderos is opinionated about safety.

## Filesystem guardrail

Senderos never modifies anything outside the Senderos directory tree.

That includes:

- the database
- config
- logs
- artifacts
- attempt records

The host agent owns its execution directory. Senderos may record the supplied
working path on a run attempt, but does not create, lock, clean, or retire it.

## Host-session guardrail

A host-agent session is not Senderos state.

Senderos may record host-session details on an attempt, but it does not trust the live session as the source of truth.
All meaningful state must be persisted back into Senderos.

## Confirmation policy

Senderos is designed for agent operation, so confirmations happen where they matter.

### No confirmation required

- read-only inspection
- status queries
- reports
- JSON output
- planning output

### Explicit Senderos confirmation required

- goal cancellation
- configuration rewrite

### Host-agent confirmation required

If the host agent must do something outside Senderos' own responsibility, the host agent handles that confirmation in its own environment.
Examples:

- create a cron job
- push a branch
- open a pull request
- call an external API
- launch external execution work from a dispatched item

## Why the split matters

This keeps Senderos strict about its own boundaries while still letting the host agent act in the outside world when instructed.
