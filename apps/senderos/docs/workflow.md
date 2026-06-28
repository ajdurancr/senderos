# Workflow — Spec → Gherkin → Execution

This repository follows a disciplined, loop-oriented workflow.

## The execution path

```text
raw user intent
  → [spec_partner] refine behavior and decisions
  → human approves spec
  → [gherkin_author] emits canonical Gherkin contract + metadata
  → SenderOS creates feature record from the approved contract
  → human approves executable contract for implementation
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
- A feature can exist before any PR exists.
- The PR opens after the first successful run updates the feature branch.
- Canceling a feature closes its PR and deletes its feature branch.
- `failed` and `blocked` are different states:
  - `failed` can revive on the same feature record
  - `blocked` must be duplicated into a new feature

## Why this exists

Code generation is cheap.
Coordination, verification, and judgment are not.

The loop exists to make execution auditable, reviewable, and resilient to context loss.
