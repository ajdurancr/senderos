---
title: project
description: "Create generic work areas or repository-backed projects for durable goals."
---

A project groups related goals and provides optional workspace/repository metadata.

```bash
senderos project create --name "Research program"
senderos project create --canonical-path /repo --github-owner owner --github-repo repo
senderos project list
senderos project show <project-id>
senderos project update <project-id> --name "Updated name"
```

Generic projects need no repository, GitHub identity, or software command setup.
They do not inherit the default software sendero: select a published workflow
explicitly when creating their goals. Goal categories can also be domain-specific.

Repository-backed projects can record a canonical path, GitHub identity, target
branch, integration mode, inferred commands, and health. None of those records
creates a checkout or gives another host access to the canonical machine's files.
Use explicit host grants and host-local workspace declarations for execution.

An explicit `--id` is optional. For repository projects, a package name can provide
a suggested ID. Inspect the created record and keep its returned stable ID.
