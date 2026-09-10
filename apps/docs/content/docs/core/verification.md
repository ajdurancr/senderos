---
title: Verification
description: "How runtime evidence, operator review, automated tests, and repository quality gates establish confidence without confusing activity with completion."
---

Senderos treats verification as durable evidence tied to a concrete execution—not as a sentence in a model response.

## Execution evidence

A run attempt can record evidence with these current kinds:

- `test` — automated or targeted test output;
- `ci` — continuous-integration status;
- `pull_request` — a reviewable code-change location;
- `artifact` — a generated report, build, or other output;
- `manual` — a human-performed check.

Each evidence record can include a label, URL, summary, and timestamp. Attaching it to an attempt preserves which execution produced the claim.

## Review decisions

An attempt review can be:

- `pending`;
- `approved`;
- `changes_requested`;
- `rejected`.

The record can include a reviewer, rationale, and review time. Studio surfaces pending reviews as an operator queue.

Review state is orchestration evidence. It does not itself merge a pull request, deploy an artifact, or perform another external action.

## Repository quality gates

Before merging a substantial Senderos change, run:

```bash
bun run typecheck
bun run test
bun run build
bun run --cwd packages/core coverage
```

Core coverage requires at least 97% overall line and function coverage and 95% per file. The coverage script also verifies that implementation modules with exported behavior have colocated tests.

For focused runtime work:

```bash
bun run --cwd packages/core test:unit
bun run --cwd packages/core test:integration
```

The CLI and Studio have their own targeted tests and typechecks. Documentation changes should pass both `bun run --cwd apps/docs typecheck` and `bun run --cwd apps/docs build`.

## What “done” should mean

A completion claim should connect three things:

1. the persisted goal and its acceptance intent;
2. the exact run attempt that produced the change;
3. evidence sufficient for the relevant reviewer or automated gate.

Senderos stores that chain so later planning can act on it—and so a human can audit why the system moved forward.
