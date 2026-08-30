---
title: Working Paths and Guardrails
description: "How Senderos records external working paths without managing workspaces."
---

Senderos does not own or allocate workspaces. The host agent chooses where it
executes work and may provide that location as `--working-path` when dispatching.

Senderos records the path on the run attempt for auditability. On a retry, a
previous working path can be reused when the host does not supply a new one.

The Senderos home directory is separate from that path. Senderos manages only
its own configuration, SQLite database, logs, cache, and artifacts under the
configured home directory.
