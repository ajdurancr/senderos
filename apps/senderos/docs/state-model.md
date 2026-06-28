# State Model

SenderOS stores orchestration truth in SQLite.

The core runtime entities are:

- `projects`
- `features`
- `runs`
- `run_attempts`
- `tasks`
- `sessions`
- `workspaces`
- `events`

## Projects

A project is valid only when SenderOS knows both:

- the canonical local repository path
- the canonical GitHub repository identity

Projects also store:

- `target_branch` — the branch new features ultimately target for PRs
- `integration_mode` — default integration strategy (`github_pr` by default)
- inferred commands (`install`, `build`, `test`, `lint`) from setup
- health status (`healthy`, `setup_failed`, `broken`, `archived`)

## Features

A feature is the durable work item.

Features are created only after:

1. the spec is refined by `spec_partner`
2. the spec is approved by the human
3. `gherkin_author` emits the canonical Gherkin contract

The feature record stores:

- approved spec text
- original source request text
- raw Gherkin text
- parsed Gherkin metadata
- base target branch snapshot
- feature branch / PR linkage when execution begins

Feature statuses are intentionally small and strict:

- `awaiting_scenario_approval`
- `active`
- `failed`
- `blocked`
- `canceled`
- `completed`

## Runs

A run is one execution request against one feature.

Rules:

- only one active run per feature at a time
- a run can make up to three internal attempts
- retries reuse the same logical run branch name but recreate the branch from a clean base
- retries start from the latest accepted feature branch tip
- successful runs merge into the feature branch automatically

Run lifecycle detail lives in the run status, not the feature status:

- `queued`
- `preparing`
- `executing`
- `validating`
- `repairing`
- `merging`
- `updating_pr`
- `cleaning_up`
- `succeeded`
- `failed`
- `canceled`

## Attempts

Attempt details are stored separately from the run summary.

Each attempt can capture:

- attempt number
- branch info
- source feature SHA
- failed step
- failure summary
- structured details

## Event Log

SenderOS keeps an append-only event stream for:

- state transitions
- user actions
- agent decisions and failures
- branch operations
- PR operations

Current state is the latest truth.
The event log explains how SenderOS got there.
