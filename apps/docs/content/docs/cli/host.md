---
title: host
description: "Register a tool/machine identity, grant project access, declare local workspaces, and discover eligible assignments."
---

A host is one concrete tool/machine identity in an execution context. Host declarations
are auditable claims; Core does not inspect remote tools, sessions, or files.

```bash
senderos host register laptop-codex --name "Laptop / Codex" --harness codex \
  --capability independent_session --capability shell
senderos host list
senderos host grant laptop-codex --project-id <project-id> --workspace-ref project-checkout
senderos host workspace laptop-codex --project-id <project-id> --available --working-path /local/checkout
senderos host discover laptop-codex
```

The project-owning context grants access; the host's own context declares local
availability. Cross-context assignment requires both. Use `host grant ... --revoke`
to revoke a grant and `host workspace ... --unavailable` when a checkout is missing.
Use different host identities for different tools on the same machine.

`host discover` lists granted unfinished assignments with preflight eligibility,
missing capabilities, and workspace blockers. An eligible declaration is not proof
that execution started; claim and record an independent session separately.

## Shared local database setup

Initialization keeps each runtime's local database under its own home. For a local
simulation, initialize each home first, then point `SENDEROS_DATABASE_URL` at the
shared initialized database and register that home's context there:

```bash
senderos host context-register --name "Second tool context" --home /second/home
```

The current home's context ID is used. No files are synchronized. For remote
libSQL, use the normal environment-only database configuration and provision each
host's workspace independently. Never publish database credentials or claim tokens.
