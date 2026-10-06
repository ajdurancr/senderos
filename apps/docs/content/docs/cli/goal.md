---
title: goal
description: "Create and manage durable software-change goals."
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

A goal is intentionally broader than a feature: its `kind` can be `feature`,
`bugfix`, `refactor`, `maintenance`, `security`, or `migration`.

`explain` is the authoritative lifecycle answer: `ready`, `running`, `blocked`,
`draft`, `completed`, or `canceled`, plus the reason and next action. Empty plan
output alone does not mean completion. Goal creation can be safely replayed when
the same stable ID and inputs are used.
