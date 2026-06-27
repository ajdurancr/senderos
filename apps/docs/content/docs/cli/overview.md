---
title: CLI Overview
description: "Why the CLI is the main interface and how agents should discover Senderos capabilities."
---

## CLI as source of truth

Senderos should expose its capabilities through a CLI because that creates a portable, inspectable, scriptable interface.

Skills should tell agents to ask Senderos what it can do instead of hardcoding all capabilities into prompt text.

## Discovery pattern

Good discovery commands look like this:

```bash
senderos help
senderos capability list --json
senderos feature help
senderos source help
senderos doctor --json
```

The first command is for humans. The JSON variants are for agents and automation.

## Why machine-readable output matters

Agents are better operators when they can consume structured data such as:

- command capability lists,
- config schemas,
- doctor output,
- status payloads,
- run summaries.

That reduces guesswork and makes multi-agent operation more reliable.

## Core principles for the command surface

### Make reads easy

Read-only operations should be fast and obvious:

```bash
senderos feature list
senderos feature status feature-123
senderos run list --active
senderos report blocked
```

### Make writes explicit

State-changing operations should be deliberate:

```bash
senderos feature kickoff feature-123
senderos feature cancel feature-123
senderos source update primary
senderos schedule add queue-poller
```

### Make destructive actions impossible to do by accident

Cleanup, cancelation, deletion, external pushes, and force overrides should require confirmation or explicit flags.
