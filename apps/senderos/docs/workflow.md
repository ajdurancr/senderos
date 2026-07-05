# Workflow — Spec → Gherkin → Planned Dispatch → Agent Execution

This repository follows a disciplined, plan-oriented workflow.

## The execution path

```text
raw user intent
  → [spec_partner] refine behavior and decisions
  → human approves spec
  → [gherkin_author] emits canonical Gherkin contract + metadata
  → SenderOS creates feature record from the approved contract
  → human approves executable contract for implementation
  → SenderOS plans the next dispatchable run
  → host agent calls senderos run dispatch with the planned ids
  → SenderOS creates run/session/run-execution state
  → host agent executes the work asynchronously in its own session
  → later dispatches continue the next sendero step after the previous run id
```

## Important rules

- Features are created only after Gherkin exists.
- The canonical feature contract is stored in SenderOS state, not in ad-hoc `.feature` files.
- Approved specs also live in SenderOS state.
- Only one active run may exist per feature at a time.
- `senderos plan` is global only and does not accept feature ids or run ids.
- `senderos plan` returns only the next dispatchable items by default.
- Dispatchable planning payload is intentionally minimal:
  - `featureId`
  - `senderoId`
  - `agentId`
  - `previousRunId`
- `senderos run dispatch` is the forward-dispatch mutation surface.
- SenderOS manages orchestration state only; the host agent performs the real work.
- A feature can exist before any PR exists.
- The PR opens after the first successful run updates the feature branch.
- Canceling a feature closes its PR and deletes its feature branch.
- `failed` and `blocked` are different states:
  - `failed` can be retried and dispatched again
  - `blocked` must be duplicated into a new feature

## CLI shape

The planning surface is `plan` and the dispatch surface is `run dispatch`.

Examples:

```bash
senderos plan
senderos plan --feature-status active --feature-status failed
senderos run dispatch --feature-id <feature-id> --sendero-id <sendero-id> --agent-id <agent-id>
senderos run dispatch --feature-id <feature-id> --sendero-id <sendero-id> --agent-id <agent-id> --previous-run-id <run-id>
senderos run state --feature-id <feature-id>
senderos run cancel <run-id>
```

## Why this exists

Code generation is cheap.
Coordination, verification, and judgment are not.

The run model exists to make execution auditable, reviewable, and resilient to context loss while keeping agents and senderos as first-class orchestration concepts and keeping the host-agent contract explicit.
