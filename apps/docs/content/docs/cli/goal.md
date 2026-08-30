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
- `cancel <goal-id>`

## Example

```bash
senderos goal create \
  --project-id <project-id> \
  --title "Fix login" \
  --kind bugfix \
  --spec-text "Users can sign in reliably"
senderos goal activate <goal-id>
```

A goal is intentionally broader than a feature: its `kind` can be `feature`,
`bugfix`, `refactor`, `maintenance`, `security`, or `migration`.
