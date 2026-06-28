---
title: project
description: "Create, inspect, and update SenderOS project records."
---

`senderos project` manages the canonical project records that SenderOS uses as the root of all feature and run state.

## Actions

- `create`
- `list`
- `show <project-id>`
- `update <project-id>`

## Examples

```bash
senderos project create \
  --canonical-path /repo/path \
  --github-owner ajdurancr \
  --github-repo senderos \
  --target-branch main

senderos project list
senderos project show senderos-ab12cd34
senderos project update senderos-ab12cd34 --target-branch develop
```

## Important rules

A SenderOS project combines:

- a canonical local repository path
- a canonical GitHub repository identity
- a target branch
- inferred or stored execution commands

If an explicit `--id` is not provided, SenderOS derives a default project id from `package.json.name` when available.

Example shape:

```text
<package-name>-<random-string>
```

## Why `project` exists

Features should not float around unattached.
SenderOS needs a durable project record first so it can:

- snapshot the target branch into features
- place workspaces under the correct project
- track GitHub identity cleanly
- keep feature/run history grouped sanely
