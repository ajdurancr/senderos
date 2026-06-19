# project-spec.md — Senderos

## Product purpose

Senderos is an engineering orchestration platform that transforms objectives into verified software outcomes by coordinating humans, AI systems, development tools, organizational knowledge, and continuous feedback loops.

## Product layers

### SenderOS

SenderOS is the orchestration runtime.

Responsibilities:
- planning
- coordination
- context management
- execution workflows
- validation routing
- engineering memory
- feedback loops
- continuous learning

### Senderos Studio

Senderos Studio is the primary user experience.

Responsibilities:
- define objectives
- inspect execution status
- review validation results
- coordinate work across humans and AI systems
- visualize the path from intent to delivery

## Global decisions

- Application source code is TypeScript only.
- Bun is the default package manager, task runner, and test runtime where applicable.
- The repository follows a spec-driven, loop-oriented execution model inspired by harness-driven execution patterns.
- Human approval happens at the executable-scenario layer before production implementation for SDD features.

## Bootstrap scope

The initial bootstrap establishes:

- Bun workspace monorepo foundation
- `apps/senderos` as the orchestration engine starting point
- `apps/studio` as the React Router-based product UI starting point
- harness-style workflow docs and agent roles in English
