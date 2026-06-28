---
title: Skills and Harnesses
description: "How host-agent skills use Senderos, what harness support exists inside Senderos, and where those boundaries stay clean."
---

Senderos expects to be operated by a host agent through the CLI.

## The host-agent contract

The host agent does not know Senderos' internal operating agents.
It knows the CLI.

A host-agent skill exists to teach the host agent how to operate Senderos correctly:

- call the right command,
- prefer machine-readable output,
- respect guardrails,
- render Senderos output back to the user clearly.

## What the skill should know

A Senderos skill should know:

- how to discover commands,
- how to request JSON output,
- how to run manual loop actions,
- how to ask the user for confirmation when Senderos requires it,
- how to schedule host-level jobs when Senderos emits scheduling instructions.

It should not know Senderos' internal operating logic.

## Harness support inside Senderos

Senderos does include harness support, but only for communicating with host-agent environments.

Examples:

- OpenClaw,
- Codex,
- Claude Code.

That support exists so Senderos can:

- attach runs to host sessions,
- query session status,
- resume known sessions,
- format execution instructions correctly for the harness.

## Why Senderos does not build broad service adapters in v1

Senderos does not own integrations for:

- GitHub APIs,
- Jira APIs,
- Linear APIs,
- notifications,
- repository hosting,
- scheduling infrastructure.

When those things are needed, Senderos tells the host agent what to do.
The host agent executes that instruction using its own capabilities.

## Adapter maintenance policy

Harness behavior changes over time.
Because of that, Senderos' harness support must be maintained against the real current behavior of each supported host environment.

That means harness support is a product boundary with explicit ownership, not a pile of hand-wavy assumptions.
