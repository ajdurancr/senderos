---
title: project
description: "Create, inspect, and update Senderos project records."
---

`senderos project` manages the canonical project records that Senderos uses as the root of all feature and run state.

A Senderos project combines:

- canonical local repository path
- canonical GitHub repository identity
- target branch
- inferred setup commands
- health state

If an explicit `--id` is not provided, Senderos derives a default project id from `package.json.name` when available.

Senderos needs a durable project record first so it can attach features, runs, workspaces, and planning state to a known repository boundary.
