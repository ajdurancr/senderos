---
title: feature
description: "Create, inspect, update, approve, and manage SenderOS features."
---

`senderos feature` is the main entry point for feature state.

## Actions

- `create`
- `list`
- `show <feature-id>`
- `update <feature-id>`
- `approve <feature-id>`
- `cancel <feature-id>`

## Examples

```bash
senderos feature create \
  --project-id senderos-ab12cd34 \
  --title "Add billing portal" \
  --spec-text "Users need a self-serve billing entry point." \
  --source-request "Please add a billing portal." \
  --gherkin $'Feature: Billing portal\n  Scenario: Open billing portal\n    Given an authenticated user\n    When they open billing\n    Then they should reach the billing portal'

senderos feature list
senderos feature show feature-001
senderos feature approve feature-001
senderos help feature approve
```

## Important rules

A feature must belong to a SenderOS project.

A feature stores:

- approved spec text
- original request text
- raw Gherkin contract text
- parsed Gherkin metadata
- lifecycle status
- branch / PR linkage once execution starts

## Typical use cases

Use `feature` to:

- register new work from an approved Gherkin contract
- inspect current feature truth
- update the feature contract when no active run exists
- approve a feature for implementation
- cancel a feature and cleanup its active execution state

## Important distinction

These are SenderOS features.
They are not GitHub issues, Jira tickets, or Linear tasks.
