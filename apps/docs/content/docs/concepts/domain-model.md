---
title: Domain Model
description: "The durable Senderos entities, their lifecycles, and their relationship to host-agent execution."
---

Senderos stores its orchestration model in SQLite.

```text
Project -> Goal -> Run -> Run Attempt
```

- A **project** identifies a repository through its path, GitHub identity,
  target branch, integration metadata, inferred commands, and health.
- A **goal** is a durable requested outcome with intake, specification, kind,
  lifecycle state, and optional branch and pull-request linkage.
- A **run** is one logical execution of a goal.
- A **run attempt** records one concrete execution: agent, transition, harness,
  session metadata, working path, checkpoints, results, failures, and retries.
- An **agent** is a persisted executor definition. An **agent transition** is
  an allowed handoff with a source agent, optional target, and objective.
- An **event** is an append-only audit record for significant state changes.

Goals begin as `draft`, become `active` when ready for planning, and can end as
`completed`, `failed`, `blocked`, or `canceled`. A goal can have many runs, and
a run can have many attempts. Retries retain their previous-attempt link and may
reuse or replace the prior working path.
