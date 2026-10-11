---
title: Domain Model
description: "Durable workflows, graph activations, host ownership, and independently executed attempts."
---

Senderos stores structured orchestration state through Drizzle and libSQL. Local
`file:` storage and remote libSQL use the same model; neither synchronizes worker
files or replaces host authentication and permissions.

- A **project** groups related outcomes. It may describe a repository with path,
  GitHub, branch, and command metadata, or be generic work with no repository.
- A **goal** is a durable requested outcome, specification, category, and lifecycle
  state pinned to a published sendero version.
- An **agent** is a user-authored instruction definition. Publication snapshots its
  instructions so later global edits do not mutate an existing goal's execution.
- A **sendero version** is a directed graph. Agent nodes own execution objectives,
  completion policies, and capability requirements; edges carry outcome conditions.
- An **activation** is one visit to an agent node. A backedge makes a new visit;
  retries retain the old visit and consume a separate attempt budget.
- A **fork generation** tracks the descendants of one fan-out. An explicitly paired
  join waits for those activated descendants to arrive or exit successfully.
  Ordinary convergence remains one activation per arrival.
- A **run/attempt** records a concrete execution reservation and its reports,
  checkpoints, results, evidence, and failure history.
- An **execution context** scopes a tool environment. A registered **host** names a
  concrete tool/machine and declares capabilities and workspace availability.
- A **workspace grant** explicitly authorizes a host to work on a project; its
  portable reference is separate from the host's verified local path.
- A **claim** assigns a time-limited owner and fencing token. A claim is distinct
  from recording an independent started worker session.
- An **event** preserves an append-only audit record of significant changes.

Goals begin as drafts. After activation, Core derives ready, running, blocked,
completed, and canceled decisions from every activation, ownership record, join,
budget, and completion gate. One successful branch or an empty ready list cannot
substitute for the goal's explicit completion decision.

The host owns actual sessions, process inspection, files, models, tools, external
effects, and scheduling. Core stores and validates the declared contract and fences
its state transitions; it cannot independently prove a host's claims are true.
