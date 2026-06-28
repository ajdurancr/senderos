---
title: How Senderos Works
description: "The end-to-end loop from feature definition to deployable outcome."
---

Senderos follows a loop-engineering execution model inspired by the workflow described in this repository.

## End-to-end loop

```text
intent
  -> feature definition
  -> executable feature contract
  -> loop start
  -> TDD implementation cycle
  -> review and pruning
  -> mutation confidence gate
  -> deployable outcome
  -> user evaluation
```

The loop does not pause for the user to review an intermediate pull request.
The loop advances until Senderos has a deployable outcome or a terminal failure state that requires intervention.

## Detailed flow

1. A user or host agent requests new work through the CLI.
2. Senderos creates or updates a Senderos feature.
3. Senderos' internal operating layer refines the feature contract.
4. The contract is translated into executable scenarios.
5. Senderos opens a loop for that feature.
6. Senderos assigns a dedicated workspace and execution policy.
7. Senderos instructs the host agent to execute the next step in the loop.
8. The host agent performs implementation work in the assigned workspace.
9. Senderos records the resulting run, session, and workspace state.
10. Senderos continues the loop through test-driven implementation, review, and mutation validation.
11. Senderos only surfaces the result back to the user after the loop reaches a deployable end state.

## Control plane and execution plane

Senderos is the control plane.
The host agent is the execution plane.

### Senderos decides:

- what feature is active,
- what the next valid step is,
- which workspace is reserved,
- what state transition is allowed,
- what the host agent must do next,
- whether the loop can continue,
- whether reconciliation is needed.

### The host agent does:

- read Senderos instructions,
- enter the assigned workspace,
- perform the coding task,
- run the requested checks,
- return machine-readable execution results.

## Why the loop is autonomous

The purpose of Senderos is not to ask the user for constant approval.
The purpose is to complete the engineering loop responsibly.

That means the loop continues through:

- specification translation,
- TDD implementation,
- review,
- mutation testing,
- final packaging of the outcome.

Only then does the user re-enter the loop to test the finished result.
