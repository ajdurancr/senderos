---
title: Engineering Guide
description: "How to extend Senderos safely, test changes, and keep runtime behavior trustworthy while improving the codebase."
---

This section is for people actively working on the Senderos codebase.
It is intentionally practical: what to change, how to validate it, and what to avoid.

## 1. Where to start

Before any implementation change, identify the scope clearly:

- Is this a **runtime model** change (schema, domain entities, migration)?
- A **service/CLI surface** change (new command, changed argument, new output contract)?
- A **workflow contract** change (planning, dispatch, acceptance criteria)?
- A **documentation-only** correction or clarification?

Classify before coding. Wrong layer edits are the most common source of regressions.

## 2. Make minimal, model-first edits

Follow this order:

1. Update docs that describe the contract first.
2. Update the Drizzle schema, inferred runtime types, and migrations.
3. Update the focused command action that owns the behavior.
4. Update CLI surface and tests.
5. Add/adjust integration tests for end-to-end behavior.
6. Re-run full verification.

Keep PRs focused: avoid changing tests and behavior for unrelated reasons.

## 3. Required validation for every substantial change

- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run coverage`
- targeted integration test(s) for the changed pathway

For CLI changes, run the relevant CLI-focused suites before and after.
For runtime model changes, include migration/state-transition cases.

## 4. API and output contract discipline

Senderos is consumed by host agents.
Any CLI contract change must preserve machine-readability and predictable output shape.

Checklist before merging:

- Are command outputs explicitly documented in docs?
- Are error messages actionable?
- Are IDs and state transitions still deterministic?
- Does the host-agent handoff still preserve `goalId`, `transitionId`, `agentId`, and `previousRunId` where relevant?

## 5. Code and test conventions

- Use TypeScript and Bun.
- Prefer explicit names and focused modules.
- Keep CLI output contracts predictable and machine-readable.
- Add a colocated test for every implementation module with exported behavior.

## 6. Safe workflow for ongoing codebase improvements

When a feature request is large, split work into

- **Phase A** — schema/domain foundation,
- **Phase B** — service orchestration,
- **Phase C** — CLI and Studio consumers,
- **Phase D** — tests and docs.

Track each phase independently so rollback remains possible.

## 7. Quality gates for contributor-facing docs

When adding new behavior:

- Update at least one relevant CLI doc page.
- Update architecture/concepts pages when model boundaries shift.
- Add or update operation docs if guardrails change.
- Keep terminology consistent (`goal`, `agent transition`, `run`, `run attempt`, `dispatch`).

## 8. Current high-value improvements to document explicitly

A few areas that are repeatedly useful for active developers:

- goal lifecycle and transition-selection rules,
- run retry semantics and expected states,
- working-path recording and reuse behavior,
- harness-boundary behavior,
- failure diagnostics for dispatch and planning gates.

If these move, include examples and one-to-one command mapping in docs.

## 9. Release and merge discipline

For non-trivial changes:

- keep PR title concise,
- include a detailed body with architecture rationale,
- list impacted commands/files and test evidence,
- confirm whether work completed all related docs.

This is your guardrail against shipping control-plane behavior by accident.

## 10. Local database contention regressions

Local files can be shared by Studio and independent CLI hosts. Core's `atomic`
helper retries only rolled-back SQLite lock contention for up to five seconds;
it must yield between attempts, preserve one claim winner, and never duplicate
writes or lifecycle events. An exhausted deadline must return a failure without
partial state, and subsequent commands must recover when the reader releases.

The installed libSQL 0.5.29 stack can retain a lock after a **prepared** `COMMIT`
returns `SQLITE_BUSY`, despite rollback and client close. This reproduces below
Core and Drizzle in both Bun and Node. For local-file transactions Core retains
the client connection and uses native SQL execution through `executeMultiple`
for commit; that API also rolls back failed commits. Remote connections retain
the driver's pinned transaction API. Do not apply local SQL transaction handling
to HTTP/WebSocket clients, where separate requests may use different sessions.

The regressions in `packages/core/src/db/concurrency.test.ts` cover overlapping
writers, commit retries, application errors, and recovery after deadline
exhaustion. `claim-contention.integration.test.ts` combines a held reader,
competing claims, and an operator overview refresh, asserting one owner and one
claim event. The external-host simulation retains its strict exactly-one-winner
assertions and records only allowlisted error codes, exit statuses, and retryable
flags for each contender. Raw claim replies and stderr must never be included in
contention diagnostics because they may contain ownership tokens or private data.

## Project overview query boundaries

An explicitly selected Studio project narrows goal, run and attempt queries in
SQL before materializing their records. Its status totals reuse those selected
records. Default programmatic overviews remain complete; context attempt
inspection still includes granted work and owned sessions after grant revocation.
A project selector must narrow that visibility, never expand it.

Keep ordering, old-attempt recovery facts, attention state and navigation choices
unchanged. The Studio context-data regression compares the complete filtered
snapshot and verifies that unrelated operational IDs are absent from database
query results, rather than merely hidden from the final HTTP payload. Core
attempt-query coverage also checks granted and revoked host ownership.
