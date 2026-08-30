# Verification

The agent does not claim success. It proves it.

## Required evidence

1. `bun run typecheck`
2. `bun run test`
3. `bun run build`
4. `bun run coverage`
5. Scenario-to-test traceability for SDD goals
6. Mutation results for touched lines when mutation workflows are in scope

## Coverage gate

The repository enforces a **97% minimum** for both:

- line coverage
- function coverage

The current coverage script is:

```bash
bun run coverage
```

That command emits LCOV, prints a JSON summary, and fails if either threshold drops below 97%.
