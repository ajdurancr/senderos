---
title: Architecture
description: "The recommended architecture: CLI first, persistent local state, adapters, and thin agent integrations."
---

## Recommended layers

Senderos works best when split into four layers.

### 1. CLI

The CLI is the public operational interface.

Examples:

```bash
senderos capability list --json
senderos feature status feature-42
senderos worker tick
senderos schedule list
senderos session resume sess-99
```

This layer should support both human-readable help and machine-readable output.

### 2. Local runtime and persistent state

This layer stores the truth that must outlive any prompt or process.

That includes:

- features,
- tasks,
- runs,
- sessions,
- source integrations,
- schedules,
- events,
- workspaces,
- artifacts.

### 3. Adapters and providers

These connect Senderos to the outside world.

Common adapter categories:

- source adapters: GitHub Issues, Linear, Notion, local files,
- agent adapters: Codex, Claude Code, OpenClaw, generic shell,
- repo adapters: git and remote hosting,
- scheduler adapters: cron, OpenClaw cron, daemon mode,
- notification adapters: chat messages, webhooks, status sinks.

### 4. Agent integrations

Skills and harness wrappers live here.

Their job is to:

- teach the agent how to discover Senderos capabilities,
- guide setup and environment configuration,
- standardize confirmation patterns,
- recover status cleanly.

They should **not** become the system of record.

## Design rules

### Local-first by default

Keep core state and orchestration inside the user environment.

### Structured discovery

Prefer commands like:

```bash
senderos capability list --json
senderos config schema --json
senderos doctor --json
```

That is more reliable for agents than freeform prose alone.

### Adapter boundaries stay real

If Senderos knows too much about one agent or one backlog system, it becomes sticky and brittle. Adapters are there to prevent that.
