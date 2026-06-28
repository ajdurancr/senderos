---
title: Workspaces and Guardrails
description: "How Senderos allocates workspaces, prevents collisions, and keeps parallel loops from stepping on each other."
---

Senderos manages workspaces explicitly.

## Workspace rules

Every active loop runs in a Senderos-managed workspace.
A workspace is never assumed. It is allocated, locked, tracked, and released.

## What Senderos tracks

For every workspace, Senderos stores:

- workspace id,
- root path,
- owning feature id,
- owning run id,
- current session id,
- lock state,
- branch identity,
- cleanup state,
- retention reason if preserved.

## Collision prevention

Parallel work only stays safe if Senderos owns workspace reservation.

Senderos prevents conflicts by enforcing:

- one active owner per workspace,
- explicit lock transitions,
- reconciliation before reuse,
- no dispatch into a dirty or orphaned workspace.

## Workspace lifecycle

```text
allocated
-> locked
-> active
-> verifying
-> released
-> cleaned | retained
```

## Host-agent responsibility inside the workspace

Once Senderos assigns the workspace, the host agent can perform implementation work there.
But the host agent does not decide workspace ownership rules. Senderos does.
