# State Model

Senderos stores orchestration truth in SQLite.

## Core entities

- `projects`: repository identity, target branch, setup knowledge, and health.
- `goals`: durable requested outcomes with a `kind`, intake text, approved specification, and PR linkage.
- `agents`: persisted executor definitions.
- `agent_transitions`: directed agent handoffs and their transition objective.
- `runs`: logical executions of a goal.
- `run_attempts`: concrete executions of a run. Each attempt records executor, transition, harness, external session metadata, retry ancestry, result, and `working_path`.
- `events`: append-only audit events using polymorphic entity references.

## Goal lifecycle

Goals begin as `draft`, become `active` when ready for planning, and end as `completed`, `failed`, `blocked`, or `canceled`. `kind` distinguishes feature work, bugfixes, refactors, maintenance, security work, and migrations without changing the lifecycle model.

## Execution lifecycle

A goal may have many runs. A run may have one or more attempts. A retry records `retry_from_attempt_id`; it may reuse a prior physical path or use a new one. The current execution state is always derived from runs and attempts, never duplicated on the goal.
