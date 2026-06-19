# Architecture — What Good Work Means Here

## Monorepo shape

- `apps/senderos` — orchestration runtime and domain logic
- `apps/studio` — user-facing web application
- `packages/` — shared TypeScript packages as the platform grows

## Principles

1. Coordination before complexity.
2. Types before guesswork.
3. Verification before closure.
4. Human-readable artifacts for clarity and portability.
5. Bun-first workflows.

## Boundaries

- SenderOS owns orchestration/runtime concerns.
- Studio owns product experience and operator workflows.
- Shared abstractions move into `packages/` only when reused by at least two apps.
