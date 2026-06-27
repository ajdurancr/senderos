---
title: Safety and Confirmations
description: "Boundaries for destructive actions, external effects, and safe operational defaults."
---

## Full access does not mean no guardrails

Senderos should provide broad operational access to its capabilities, but always under policy and confirmation boundaries.

That means the system should distinguish between read-only visibility and high-impact actions.

## Action classes

### Safe reads

No confirmation required:

- list features,
- inspect runs,
- check schedules,
- show logs,
- generate reports,
- print config schema.

### Local transformations

Usually safe with light warnings:

- refine a spec,
- regenerate Gherkin,
- sync source metadata,
- rebuild search indexes,
- refresh local cache.

### Destructive or external actions

These should require confirmation or explicit force flags:

- kickoff a feature,
- cancel a feature,
- delete records,
- push branches,
- open or merge a PR,
- clean a workspace,
- overwrite integration configuration.

## Why this matters for agents

Agents are fast. That is not the same thing as safe.

Senderos should make it difficult for an agent to:

- start duplicate work,
- push code without approval,
- clean the wrong workspace,
- mutate production-facing config casually.

Good boundaries are not friction for its own sake. They are what make automation acceptable.
