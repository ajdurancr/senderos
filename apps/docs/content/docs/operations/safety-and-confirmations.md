---
title: Safety and Guardrails
description: "The coordination boundary, ownership contract, and external host's responsibilities."
---

## Files and database access

Initialization keeps the default local database and runtime directories under the
selected Senderos home. Runtime commands use the configured database connection,
which may point to a shared local file or remote libSQL service. Protect that
connection as trusted access; context filters and host grants are coordination
rules, not authentication or tenant-security isolation.

The host owns its workspace. Senderos records grants, availability declarations,
and actual execution paths; it does not clone, synchronize, clean, inspect, or
retire those directories. Do not treat another machine's path as locally available.

## Ownership and sessions

A reservation does not start a worker. Claiming assigns a lease and fence; the host
must separately start and record an independent worker session. Core enforces the
declared protocol, including separate worker/parent IDs. The host provides and
verifies the actual separation, filesystem, capabilities, and process state.

Keep claim tokens private. Stale tokens cannot report authoritative results.
Lease expiry is not proof that a process stopped. Unknown process state stays
blocked; explicit stop confirmation is needed before abandonment. Revoking a grant
blocks new work but allows an existing owner to report or acknowledge shutdown.
It does not kill the external process.

## Explicit operations and host permissions

Initialization writes require `--approve`. Workflow publication, goal activation,
cancellation, recovery, budget changes, and host grants are explicit CLI operations;
they are not inferred from a model's prose. These commands do not replace the
operator's own authorization policy.

The host must apply its own confirmations and permissions for external actions,
including scheduling, credentials, messages, API calls, purchases, code pushes,
merges, and deployments. Senderos never grants authority to perform those effects
merely because an execution packet mentions them.

Planning may initialize or reconcile lifecycle state, but never dispatches or
launches work. Studio and CLI review/evidence records are audit records. Core does
not independently verify their truth, authenticate a reviewer, or execute any
external action implied by an approval.
