---
title: Verification
description: "The checks that establish Senderos runtime, CLI, and documentation quality."
---

Run the full repository checks before merging substantial work:

```bash
bun run typecheck
bun run test
bun run build
bun run --cwd packages/core coverage
```

Senderos coverage requires at least 97% overall line and function coverage and
95% per-file coverage. The coverage command also verifies that implementation
modules with functions have colocated tests.

For targeted work, run:

```bash
bun run --cwd packages/core test:unit
bun run --cwd packages/core test:integration
```
