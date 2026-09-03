---
title: How Senderos Works
description: "The path from a requested outcome to a recorded external execution."
---

Senderos owns orchestration state; the host agent performs product-code work.

```text
project -> draft goal -> active goal -> plan -> run -> run attempt
                                               -> host execution -> recorded outcome
```

1. Create a project for the target repository.
2. Create a goal with its kind, intake, and specification.
3. Activate the goal when it is ready to execute.
4. Run `senderos plan` to obtain a dispatchable goal, transition, and agent.
5. Dispatch an item with `senderos run dispatch`.
6. Senderos persists the run and first attempt.
7. The host agent records checkpoints, status, and results on the attempt.
8. Planning advances completed work or retries failed work.
