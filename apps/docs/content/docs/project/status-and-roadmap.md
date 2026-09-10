---
title: Status & roadmap
description: "A clear boundary between the Senderos capabilities implemented on main and the near-term product direction."
---

Senderos is an early, functional `v0.1` foundation under active development. The orchestration model and core operating loop exist; packaging, product ergonomics, and deeper automation are still evolving.

This page describes direction, not a contractual release schedule.

## Available on main

### Runtime and persistence

- typed TypeScript core API;
- Drizzle-backed local or remote libSQL storage;
- migrations and built-in agent seeding;
- durable projects, goals, agents, transitions, runs, attempts, and append-only events;
- configurable runtime home, artifact, log, and cache paths.

### Planning and execution records

- goal activation and cancellation;
- read-only global planning of dispatchable work;
- validated run dispatch through a selected agent transition;
- retries linked to prior runs and attempts;
- attempt checkpoints, host-session metadata, working paths, results, and failure summaries;
- cancellation and lifecycle status reporting.

### Verification and operations

- structured test, CI, pull-request, artifact, and manual evidence records;
- human review decisions attached to attempts;
- system health diagnostics through `doctor`;
- machine-readable CLI help and JSON output;
- initial Studio Mission Control queues and lifecycle actions;
- bootstrap generation for a host-agent operator skill.

## Important current limitations

- Senderos is run from source; no public registry package is documented yet.
- The host environment still launches, resumes, and monitors actual model sessions.
- Scheduling belongs to the host environment.
- GitHub, issue tracker, deployment, and notification APIs are not Senderos-owned integrations.
- Studio is an initial operational surface, not yet a complete replacement for the CLI.
- The roadmap is not represented by public GitHub milestones or open issues today.

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
