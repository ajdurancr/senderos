---
title: Status & roadmap
description: "A clear boundary between the Senderos capabilities in this source checkout and the near-term product direction."
---

Senderos is an early, functional `v0.1` foundation under active development. The orchestration model and core operating loop exist; packaging, product ergonomics, and deeper automation are still evolving.

This page describes direction, not a contractual release schedule.

## Available in this implementation

### Runtime and persistence

- typed TypeScript core API;
- Drizzle-backed local or remote libSQL storage;
- migrations and built-in agent seeding;
- durable projects, goals, agents, transitions, runs, attempts, and append-only events;
- configurable runtime home, artifact, log, and cache paths.

### Planning and execution records

- custom agent and sendero authoring with publication-pinned instructions;
- outcome conditions, backedges, finite activation budgets, fan-out, and explicit joins;
- goal activation and cancellation;
- context-scoped planning/explanation with durable graph activations;
- validated run dispatch through a selected agent transition;
- retries linked to prior runs and attempts;
- attempt checkpoints, host-session metadata, working paths, results, and failure summaries;
- registered host capabilities, explicit workspace grants, preflight, and separate claim/start records;
- recorded active/finished/missing/unknown session reconciliation;
- cancellation and lifecycle status reporting.

### Verification and operations

- structured test, CI, pull-request, artifact, and manual evidence records;
- human review decisions attached to attempts;
- system health diagnostics through `doctor`;
- machine-readable CLI help and JSON output;
- Studio agent/graph authoring, scoped reviewed dispatch, lifecycle actions, and per-activation host/session visibility;
- bootstrap generation for a host-agent operator skill.

## Important current limitations

- The deterministic external-host simulator validates one local machine and local libSQL; real harnesses and remote deployments need adapter-specific tests.
- The host environment still launches, resumes, and monitors actual model sessions.
- Scheduling belongs to the host environment.
- GitHub, issue tracker, deployment, and notification APIs are not Senderos-owned integrations.
- Studio is an initial operational surface, not yet a complete replacement for the CLI.

## Near-term direction

The next useful layer is productization of the existing control plane:

1. **Mission Control depth** — richer goal and attempt detail, clearer intervention states, and more complete evidence-review workflows.
2. **Distribution** — an ergonomic installation path and versioned releases beyond running directly from the monorepo.
3. **Execution visibility** — stronger heartbeat, stale-run, resume, and recovery experiences while preserving the host boundary.
4. **Host-agent adapters** — better operator skills and harness-specific guidance without moving orchestration policy into those adapters.
5. **Verification workflows** — clearer acceptance evidence, review gates, and retry feedback across the full goal lifecycle.
6. **Operational hardening** — deeper diagnostics, migration confidence, and remote libSQL deployment guidance.

## What is deliberately not the plan

Senderos should not become a grab bag of direct integrations or a replacement for every agent harness. Near-term work should preserve these constraints:

- one deterministic orchestration model;
- one durable source of truth;
- thin, replaceable host adapters;
- external side effects owned by the environment with the relevant credentials and permissions;
- explicit evidence rather than optimistic completion claims.

Follow the [GitHub repository](https://github.com/ajdurancr/senderos) for merged work. Until formal milestones are published, this page should be updated whenever the boundary between “available” and “next” changes.
