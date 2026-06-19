# Senderos

Senderos is an engineering orchestration platform that transforms objectives into verified software outcomes by coordinating humans, AI systems, development tools, organizational knowledge, and continuous feedback loops.

This repository contains the initial monorepo scaffold for Senderos.

## Monorepo apps

- `apps/senderos` — SenderOS, the orchestration engine/runtime.
- `apps/studio` — Senderos Studio, the primary product UI built with React Router.

## Technology decisions

- **Language:** TypeScript only
- **Package manager/runtime:** Bun
- **Monorepo:** Bun workspaces
- **UI app:** React Router v8+ (latest available at scaffold time)

## Why Senderos exists

Software teams can generate more code than ever, but generation alone does not guarantee useful outcomes.

The harder problem is coordination:

- turning goals into executable work
- bringing the right context to the right moment
- validating whether the result actually works
- keeping humans, tools, and automation aligned
- preserving decisions so the system improves over time

Senderos exists to make that coordination visible, structured, and repeatable.

## How Senderos can be used

Senderos can be used as the operating layer around software delivery.

A team defines an objective, clarifies what success looks like, gathers the relevant context, coordinates implementation, reviews outcomes, and keeps the feedback loop moving.

In practice, that can mean helping teams:

- shape work around outcomes instead of disconnected tasks
- keep execution aligned across humans and AI systems
- make validation and review part of the path, not an afterthought
- turn decisions, progress, and results into usable organizational memory

The goal is not just to produce software faster.
The goal is to move from intent to verified outcome with more clarity and less coordination waste.

## Product thesis

Software generation is no longer the main bottleneck.
Coordination is.

Senderos exists to orchestrate the path from intent to verified delivery:

Intent → Planning → Context → Execution → Validation → Feedback → Continuous Improvement

## Getting started

### Prerequisites

- Bun `>=1.3`

### Install

```bash
bun install
```

### Run the apps

```bash
bun run dev:senderos
bun run dev:studio
```

### Quality gates

```bash
bun run typecheck
bun run test
bun run build
```

## Repository structure

- Root: monorepo workspace, shared config, and top-level documentation only
- `apps/senderos`: SenderOS app plus its local docs, agent roles, and templates
- `apps/studio`: Studio web app
