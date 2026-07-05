---
title: Workspaces and Guardrails
description: "How Senderos allocates workspaces, prevents collisions, and keeps concurrent execution from stepping on itself."
---

Senderos manages workspaces explicitly.

## Workspace rules

Every dispatched run uses a Senderos-managed workspace.
A workspace is never assumed. It is allocated, locked, tracked, and cleaned or retained intentionally.

## What Senderos tracks

For every workspace, Senderos stores:

- workspace id
- root path
- owning feature id
- owning run id
- current session id
- lock state
- branch identity
- cleanup state
- retention reason if preserved

## Path layout

The current project-aware workspace layout is:

```text
.senderos/workspaces/<project-id>/<feature-id>
```

## Materialization behavior

When Senderos allocates a workspace, it materializes a project snapshot there for execution.
That makes the workspace useful for local and CI testing instead of leaving an empty directory placeholder.

## Collision prevention

Parallel work only stays safe if Senderos owns workspace reservation.

Senderos prevents conflicts by enforcing:

- one active run per feature
- explicit lock transitions
- no dispatch into a dirty or orphaned workspace

## Workspace lifecycle

```text
allocated
-> active | locked
-> cleaned | retained
```

## Host-agent responsibility inside the workspace

Once Senderos assigns the workspace, the host agent can perform implementation work there.
But the host agent does not decide workspace ownership rules. Senderos does.
