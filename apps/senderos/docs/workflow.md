# Workflow — Harness-Inspired Execution Loop

This repository follows a disciplined, loop-oriented workflow inspired by harness-driven execution patterns.

## The five-stage loop

```text
pending
  → [spec_partner]   discussion → project-spec.md
  → [gherkin_author] contract   → features/<name>.feature
  → ⏸ human approval on executable scenarios
  → in_progress
  → [tdd_craftsman]  Red → Green → Refactor
  → [judge]          review and pruning
  → [mutation_tester] mutation confidence gate
  → done
```

## Why this exists

Code generation is cheap.
Coordination, verification, and judgment are not.

The loop exists to make engineering execution auditable, reviewable, and resilient to context loss.

## Rules

- One feature at a time.
- Human approval happens before production implementation for SDD work.
- State lives on disk, not only in chat.
- No feature reaches `done` without review and mutation confidence.
