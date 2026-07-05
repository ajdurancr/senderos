---
title: How Senderos Works
description: "The end-to-end path from approved Gherkin contract to planned dispatch and recorded execution outcome."
---

Senderos follows a planning-and-dispatch execution model.

## End-to-end path

```text
intent
  -> approved spec
  -> approved Gherkin contract
  -> project-linked feature record
  -> plan next dispatchable work
  -> dispatch one run
  -> external agent execution
  -> review / mutation / next dispatch
  -> completed outcome or explicit failure state
```

## Detailed flow

1. A user or host agent creates or selects a Senderos project.
2. Senderos stores the project identity and target branch.
3. Senderos creates a feature from an approved Gherkin contract.
4. The feature is explicitly approved for implementation.
5. Senderos plans the next dispatchable work item.
6. The host agent calls `senderos run dispatch ...` for one planning item.
7. Senderos allocates a project-aware workspace and creates run/session/run-execution state.
8. The host agent performs the actual work in the assigned workspace/session.
9. Senderos records the resulting run, session, and workspace state.
10. Later planning/dispatch cycles move the feature through the next sendero step.
11. When the path finishes, Senderos closes the active session records and cleans the workspace.

## Control plane and execution plane

Senderos is the control plane.
The host agent is the execution plane.

### Senderos decides:

- what project and feature are active
- what the next dispatchable work item is
- which workspace is reserved
- what state transition is allowed
- whether a retry or next dispatch is valid

### The host agent does:

- read Senderos planning output
- dispatch one item at a time
- enter the assigned workspace
- perform the coding task
- run the requested checks
- return later for the next planning/dispatch cycle

## Current implementation note

The current runtime and tests fully exercise the Senderos state model, CLI flow, workspace lifecycle, and planning/dispatch behavior.
Harness-specific execution is still represented as recorded session state rather than Senderos directly launching the external agent.
