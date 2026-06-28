---
title: Workspaces and Guardrails
description: "How SenderOS allocates workspaces, prevents collisions, and keeps loops from stepping on each other."
---

SenderOS manages workspaces explicitly.

## Workspace rules

Every active loop runs in a SenderOS-managed workspace.
A workspace is never assumed. It is allocated, locked, tracked, and cleaned or retained intentionally.

## What SenderOS tracks

For every workspace, SenderOS stores:

- workspace id
- root path
- owning project id
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

This keeps feature work grouped under the owning project instead of flattening every feature into one shared directory.

## Materialization behavior

When SenderOS allocates a workspace, it materializes a project snapshot there for execution.
That makes the workspace useful for local and CI testing instead of leaving an empty directory placeholder.

## Collision prevention

Parallel work only stays safe if SenderOS owns workspace reservation.

SenderOS prevents conflicts by enforcing:

- one active run per feature
- explicit lock transitions
- reconciliation before reuse
- no dispatch into a dirty or orphaned workspace

## Workspace lifecycle

```text
allocated
-> active | locked
-> cleaned | retained
```

## Host-agent responsibility inside the workspace

Once SenderOS assigns the workspace, the host agent can perform implementation work there.
But the host agent does not decide workspace ownership rules. SenderOS does.
