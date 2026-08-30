# Workflow

1. Capture a request as a draft goal.
2. Refine and approve its specification.
3. Activate the goal.
4. Use `senderos plan` to obtain a dispatchable goal, transition, and executor.
5. Dispatch a run. Senderos creates its first run attempt and records the physical working path when supplied.
6. Persist attempt status and results. A later run can retry from the previous attempt while reusing or replacing its path.

Senderos owns orchestration state. The host agent performs the actual coding work.
