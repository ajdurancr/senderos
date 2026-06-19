# Claude Adapter

This directory contains Claude-specific guidance for executing SenderOS agent roles.

## Boundary

The canonical agent definitions live in:

```text
apps/senderos/agents/
```

Claude is an execution adapter, not the source of truth for SenderOS roles.

## Mapping

Current canonical roles:
- `craftsman-lead.md`
- `spec-partner.md`
- `gherkin-author.md`
- `tdd-craftsman.md`
- `judge.md`
- `mutation-tester.md`

If Claude-specific wrappers are needed later, they should be generated or maintained here without changing the canonical definitions.
