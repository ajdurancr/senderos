---
title: loop
description: "Operate the engineering loop: start it, resume it, tick it manually, and inspect its state."
---

`senderos loop` is the operational command group for the engineering factory.

## Actions

- `start <feature-id>`
- `resume <feature-id>`
- `tick <feature-id>`
- `show <feature-id>`

## Examples

```bash
senderos loop start feature-001
senderos loop show feature-001
senderos loop tick feature-001
senderos loop resume feature-001
senderos help loop show
```

## What happens on start

`loop start` does not just flip a flag.
It currently:

- allocates a SenderOS workspace under the owning project path
- creates the implementation task if needed
- creates a run record
- creates a session record
- stores machine-readable execution instructions for the current phase

## Current manual use

`tick` is useful when:

- the host has no scheduler yet
- you want to advance the loop on demand
- you are debugging a stuck feature
- you are validating the runtime state machine locally

## Current phase model

SenderOS currently advances features through:

```text
implementation
-> review
-> mutation
-> done
```

At completion, SenderOS marks the feature completed, closes the active session records, and cleans the workspace.
