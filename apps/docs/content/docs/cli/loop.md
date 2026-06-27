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
senderos loop show feature-001 --json
senderos loop tick feature-001
senderos loop resume feature-001
```

## What it means

`loop start` opens the autonomous feature-delivery loop.
From there, Senderos drives the sequence through implementation, review, and mutation validation until the feature reaches a deployable end state or a terminal failure condition.

## Manual use cases

Use `tick` when:

- the host has no scheduler,
- you want to advance the loop on demand,
- you are debugging a stuck feature.
