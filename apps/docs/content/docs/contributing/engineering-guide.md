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
2. Update runtime domain types, mappers, and migrations.
3. Update the focused command action that owns the behavior.
4. Update CLI surface and tests.
5. Add/adjust integration tests for end-to-end behavior.
6. Re-run full verification.

Keep PRs focused: avoid changing tests and behavior for unrelated reasons.

## 3. Required validation for every substantial change

- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run --cwd packages/senderos coverage`
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
- **Phase C** — CLI and adapters,
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
