---
title: What is Senderos?
description: "A durable control plane that turns software objectives into planned, auditable, and verifiable execution across AI agents and developer tools."
---

Senderos coordinates software work that outlives any one prompt, model, or coding session. It stores the goal, determines the next valid handoff, records concrete execution attempts, and preserves the evidence needed to decide whether work should advance.

> Senderos is not another coding agent. It is the system of record and control plane around coding agents.

## The problem it solves

Agent harnesses are increasingly capable at editing code, running tools, and producing a result. The hard part is everything around that execution:

- keeping the original objective and constraints intact across sessions;
- deciding which agent or role should act next;
- distinguishing a requested outcome from each attempt to achieve it;
- recovering from failures without discarding history;
- connecting test, CI, pull-request, artifact, and human-review evidence to the exact execution;
- giving humans a trustworthy answer to “what is happening now?”

Prompt history alone is a poor database for that work. Senderos makes the coordination state explicit.

## What Senderos provides

Senderos currently provides four connected surfaces:

| Surface | Responsibility |
| --- | --- |
| `@senderos/core` | Typed orchestration commands, planning rules, persistence, and Mission Control APIs |
| `senderos` CLI | Machine-readable access to initialization, projects, goals, agents, transitions, plans, runs, attempts, and system health |
| Senderos Studio | A Mission Control interface for operational visibility and review workflows |
| Host-agent contract | A clean boundary for OpenClaw, Codex, Claude Code, or another harness to execute real repository work |

Structured state is stored through Drizzle on libSQL. A local `file:` database is the default; a remote libSQL endpoint can use the same runtime model.

## The operating model

```text
human intent
  -> project + goal
  -> Senderos plans the next agent transition
  -> Senderos dispatches a run and records an attempt
  -> host agent executes in the repository
  -> evidence, status, and result return to Senderos
  -> review, retry, complete, or advance
```

The boundary is deliberate:

- **Senderos owns** orchestration truth, lifecycle validation, planning, dispatch records, and audit history.
- **The host owns** model sessions, repository operations, tools, credentials, scheduling, and external side effects.

That separation lets execution environments change without changing the meaning of the work.

## What to expect today

Senderos is at `v0.1` and under active development. The core model, CLI, libSQL persistence, host-agent boundary, evidence/review records, and initial Studio Mission Control are implemented. Distribution is not packaged for a public registry yet, so the current installation path runs from source with Bun.

Start with [Install & configure](./getting-started/setup), then follow the [Quickstart](./getting-started/quickstart) to create and dispatch a real goal. See [Status & roadmap](./project/status-and-roadmap) for an honest line between current capability and near-term direction.
