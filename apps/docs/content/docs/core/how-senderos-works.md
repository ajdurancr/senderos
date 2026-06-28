---
title: How SenderOS Works
description: "The end-to-end loop from approved Gherkin contract to recorded execution outcome."
---

SenderOS follows a loop-engineering execution model.

## End-to-end loop

```text
intent
  -> approved spec
  -> approved Gherkin contract
  -> project-linked feature record
  -> loop start
  -> implementation
  -> review
  -> mutation
  -> completed outcome or explicit failure state
```

## Detailed flow

1. A user or host agent creates or selects a SenderOS project.
2. SenderOS stores the project identity and target branch.
3. SenderOS creates a feature from an approved Gherkin contract.
4. The feature is explicitly approved for implementation.
5. SenderOS opens a loop for that feature.
6. SenderOS allocates a project-aware workspace.
7. SenderOS creates the run, task, and session records for the current phase.
8. The host agent performs work in the assigned workspace.
9. SenderOS records the resulting run, session, and workspace state.
10. SenderOS continues the loop through implementation, review, and mutation validation.
11. When the loop finishes, SenderOS closes the active session records and cleans the workspace.

## Control plane and execution plane

SenderOS is the control plane.
The host agent is the execution plane.

### SenderOS decides:

- what project and feature are active
- what the next valid step is
- which workspace is reserved
- what state transition is allowed
- what the host agent must do next
- whether the loop can continue
- whether reconciliation is needed

### The host agent does:

- read SenderOS instructions
- enter the assigned workspace
- perform the coding task
- run the requested checks
- return machine-readable execution results

## Current implementation note

The current runtime and tests fully exercise the SenderOS state machine, CLI flow, workspace lifecycle, and reconciliation behavior.
Harness-specific execution is still represented as recorded session metadata plus launch instructions rather than a fully bound external agent session in every environment.
