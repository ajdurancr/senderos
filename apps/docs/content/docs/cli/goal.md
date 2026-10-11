---
title: goal
description: "Create and manage durable goals across software and generic projects."
---

`senderos goal` manages the requested outcomes that Senderos plans and dispatches.

## Actions

- `create`
- `list`
- `show <goal-id>`
- `update <goal-id>`
- `activate <goal-id>`
- `explain <goal-id>`
- `retry-budget <goal-id> --max-attempts <number>`
- `activation-budget <goal-id> --max-activations <number>`
- `cancel <goal-id>`

## Example

```bash
senderos goal create \
  --id <stable-id> \
  --project-id <project-id> \
  --title "Fix login" \
  --kind bugfix \
  --spec-text "Users can sign in reliably"
senderos goal activate <goal-id>
senderos goal explain <goal-id>
```

A goal is broader than a software feature: `kind` accepts a meaningful custom
category as well as common values such as `feature`, `bugfix`, or `research`.
Generic projects do not inherit a software workflow; select an explicit published
`--sendero-version-id` before activation. Existing goals keep that version and its
snapshotted instructions.

Retries and graph visits have separate budgets. `retry-budget` changes the number
of attempts allowed for one activation. `activation-budget` explicitly raises or
changes the finite graph visit limit; this can unblock pending graph expansion
without changing or replaying a successful attempt result. Budget commands on a
draft reject with `GOAL_NOT_ACTIVE`; they never implicitly activate it. Set the
graph budget in its definition before activation.

`explain` is the authoritative lifecycle answer: `ready`, `running`, `blocked`,
`draft`, `completed`, or `canceled`, plus the reason and next action. Empty plan
output alone does not mean completion. Goal creation can be safely replayed when
the same stable ID and inputs are used.
