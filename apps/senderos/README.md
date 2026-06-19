# SenderOS

SenderOS is the orchestration engine for Senderos.

This app contains the runtime/domain starting point for the platform, plus documentation, canonical agent-role definitions, templates, and examples that describe how SenderOS should coordinate project execution.

## Important boundary

SenderOS is the factory.
It should not treat project-specific execution files as repository-owned runtime state.

That means live artifacts such as feature backlogs, project specs, executable scenarios, progress logs, and project memory should live in workspace-managed state like:

```text
<workspace>/.senderos/projects/<project-id>/
```

## What lives here

- `src/` — SenderOS runtime and domain code
- `tests/` — SenderOS verification
- `agents/` — canonical vendor-neutral agent roles in Markdown
- `adapters/` — provider-specific execution adapters
- `docs/` — methodology and architecture docs
- `templates/` — starter file-backed project-state templates
- `examples/` — example workspace layouts
