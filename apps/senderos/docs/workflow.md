# Workflow — Spec → Gherkin → Agent-Driven Run Execution

This repository follows a disciplined, run-oriented workflow.

## The execution path

```text
raw user intent
  → [spec_partner] refine behavior and decisions
  → human approves spec
  → [gherkin_author] emits canonical Gherkin contract + metadata
  → SenderOS creates feature record from the approved contract
  → human approves executable contract for implementation
  → SenderOS starts a run for the feature
  → the run binds to one executing agent
  → the agent runs a sendero toward its goal
  → [tdd_craftsman] Red → Green → Refactor
  → [judge] review and pruning
  → [mutation_tester] mutation confidence gate
  → feature PR evolves until merge to target branch
```

## Important rules

- Features are created only after Gherkin exists.
- The canonical feature contract is stored in SenderOS state, not in ad-hoc `.feature` files.
- Approved specs also live in SenderOS state.
- Only one active run may exist per feature at a time.
- A run may be started with explicit `--agent-id` and `--sendero-id` bindings.
- A sendero belongs to a source agent and may point toward a target agent.
- Agent execution metadata is stored on the run path, not as an external sidecar command surface.
- A feature can exist before any PR exists.
- The PR opens after the first successful run updates the feature branch.
- Canceling a feature closes its PR and deletes its feature branch.
- `failed` and `blocked` are different states:
  - `failed` can revive on the same feature record
  - `blocked` must be duplicated into a new feature

## CLI shape

The primary execution surface is now `run`.

Examples:

```bash
senderos run start --feature-id <feature-id>
senderos run start --feature-id <feature-id> --agent-id <agent-id> --sendero-id <sendero-id>
senderos run state --feature-id <feature-id>
senderos run advance --feature-id <feature-id>
senderos run cancel <run-id>
```

## Why this exists

Code generation is cheap.
Coordination, verification, and judgment are not.

The run model exists to make execution auditable, reviewable, and resilient to context loss while keeping agents and senderos as first-class orchestration concepts.
