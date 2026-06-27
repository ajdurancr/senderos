---
title: Setup and First Run
description: "A practical path to bootstrapping Senderos and using it through the CLI and an agent skill."
---

## High-level setup flow

A practical first-run path looks like this:

1. install the Senderos CLI in the user environment,
2. run `senderos init`,
3. run `senderos doctor`,
4. configure at least one source adapter,
5. configure at least one agent adapter,
6. create or sync the first feature,
7. clarify and approve the spec,
8. generate acceptance criteria,
9. kick off the implementation run.

## Example bootstrap flow

```bash
senderos init
senderos doctor
senderos source add github
senderos agent add codex
senderos feature create
senderos spec start feature-001
senderos feature approve feature-001
senderos gherkin generate feature-001
senderos feature kickoff feature-001
```

## What the agent skill should do

A Senderos skill should not pretend to know every capability up front.

Instead it should:

1. check `senderos capability list --json`,
2. inspect the relevant `help` output for the requested action,
3. guide the user through missing configuration,
4. ask for confirmation before destructive or external actions,
5. keep using the CLI for status and follow-up operations.

## Suggested minimum viable configuration

For a realistic v1, the minimum setup can be:

- one source adapter,
- one agent adapter,
- local SQLite persistence,
- local filesystem artifacts,
- one scheduling backend,
- one target repo workflow.

That is enough to prove the architecture without building an entire civilization on day one.
