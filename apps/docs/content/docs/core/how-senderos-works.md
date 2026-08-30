---
title: How Senderos Works
description: "The end-to-end path from a requested goal to a recorded execution attempt."
---

Senderos is a planning-and-dispatch control plane. It stores orchestration
truth; an external host agent performs the product-code work.

## End-to-end path

```text
intent -> project -> draft goal -> active goal -> plan -> run -> run attempt
                                                     -> host execution -> recorded outcome
```

## Detailed flow

1. Create or select a Senderos project.
2. Create a goal with its kind and specification.
3. Activate the goal when it is ready to be planned.
4. Run `senderos plan` to obtain a goal, transition, and agent.
5. Dispatch exactly one item with `senderos run dispatch`.
6. Senderos records the logical run and its first concrete attempt.
7. The host agent executes the work in its own environment and may supply a working path.
8. Later planning and dispatch cycles advance the goal or retry a failed run.

## Responsibility boundary

Senderos decides which goal is dispatchable and validates persisted state. The
host agent decides how to execute the work, manage its checkout, and interact
with external systems. A working path is recorded for auditability, not managed
as a Senderos workspace.
