# Storage Model

SenderOS is the factory and orchestration engine. It should not treat project-specific execution state as repository-owned product state.

## Boundary

### SenderOS repository
The repository contains:
- runtime and domain code
- tests
- SenderOS documentation
- templates for file-backed project state
- examples of workspace layouts

The repository does **not** contain live project execution state as a canonical persistence model.

### Workspace runtime state
Real project state should live under a workspace-managed directory such as:

```text
<workspace>/.senderos/
  workspace.json
  runtime/
  projects/
    <project-id>/
      project.json
      feature-list.json
      project-spec.md
      features/
      progress/
      memory/
```

## File-backed mode
For now, SenderOS uses files as the reference storage model. This keeps the system inspectable and portable while the long-term persistence layer is still being defined.

## Future direction
Later, SenderOS can introduce a database-backed storage adapter where:
- the database becomes the canonical structured store
- markdown and JSON remain readable/exported artifacts when useful

## Design rule
If a file describes SenderOS itself, it belongs in the repository.
If it describes work SenderOS is managing, it belongs in workspace/project state.
