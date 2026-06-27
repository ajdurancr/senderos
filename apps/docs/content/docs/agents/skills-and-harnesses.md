---
title: Skills and Harnesses
description: "How agent skills should wrap Senderos without becoming the architecture."
---

## The right split

Senderos should be the product. Skills should be the adapter.

That means:

- Senderos CLI = control plane,
- skill = instructions for how an agent should use the CLI,
- harness integration = environment-specific execution details.

## Universal skill pattern

A good universal Senderos skill should do a few things well:

1. explain when Senderos is relevant,
2. instruct the agent to discover capabilities via the CLI,
3. guide setup and environment variable configuration,
4. define confirmation requirements,
5. explain how to inspect status and resume work.

## Harness-specific helper layer

Different agent environments have different quirks:

- PTY behavior,
- session resumption,
- background tasks,
- approval systems,
- shell access,
- how logs are fetched.

Because of that, it is reasonable to have small wrappers such as:

- Senderos for OpenClaw,
- Senderos for Codex,
- Senderos for Claude Code.

Those wrappers should stay thin. They exist for ergonomics, not for core business logic.

## Setup expectation

The portable thing to install is the **CLI in the environment**.

After that, the agent integration can teach the operator how to:

- run `senderos init`,
- inspect `senderos doctor`,
- configure source and agent adapters,
- enable schedules,
- launch feature workflows.

## Why this matters

If the skill becomes the main implementation of Senderos, behavior will drift across agent ecosystems. Then you are maintaining several approximate versions of the same product. That is how you earn yourself a stupid maintenance burden.
