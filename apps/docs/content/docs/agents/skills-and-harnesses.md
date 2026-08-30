---
title: Skills and Harnesses
description: "How host-agent skills use Senderos, what harness support exists inside Senderos, and where those boundaries stay clean."
---

Senderos expects to be operated by a host agent through the CLI.

## The host-agent contract

The host agent operates Senderos through the CLI.

A host-agent skill exists to teach the host agent how to operate Senderos correctly:

- call the right command,
- prefer machine-readable output,
- respect guardrails,
- render Senderos output back to the user clearly.

## What the skill should know

A Senderos skill should know:

- how to discover commands,
- how to request JSON output,
- how to run manual planning-and-dispatch loops,
- how to ask the user for confirmation when Senderos requires it,
- how to schedule host-level jobs when its environment needs them.

It should not know Senderos' internal operating logic.

## Harness boundary

Senderos records the selected harness and optional external-session details on a
run attempt. It does not launch, query, or resume a host-agent session itself.

Examples:

- OpenClaw,
- Codex,
- Claude Code.

Those details make attempts auditable without turning a host environment into
Senderos-owned state.

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
