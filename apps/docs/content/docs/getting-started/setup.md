---
title: Setup and First Run
description: "How Senderos is installed, configured, and started in a real environment."
---

Senderos is installed into the local environment and operated through the CLI.

## First-run flow

1. install the CLI
2. run `senderos init`
3. inspect the previewed configuration
4. rerun `senderos init --approve` once the configuration is acceptable
5. run `senderos doctor`
6. create the first project
7. create the first goal
8. activate the goal
9. call `senderos plan`
10. dispatch one returned item with `senderos run dispatch ...`

## Example

```bash
senderos init --home ./.senderos --harness codex
senderos init --home ./.senderos --harness codex --approve
senderos doctor --home ./.senderos
senderos project create \
  --home ./.senderos \
  --canonical-path /repo/path \
  --github-owner ajdurancr \
  --github-repo senderos
senderos goal create \
  --home ./.senderos \
  --project-id senderos-ab12cd34 \
  --title "Add billing portal" \
  --kind feature \
  --spec-text "Authenticated users can open the billing portal."
senderos goal activate <goal-id> --home ./.senderos
senderos plan --home ./.senderos
senderos run dispatch --goal-id <goal-id> --transition-id <transition-id> --agent-id <agent-id> --working-path /repo/path --home ./.senderos
senderos status --home ./.senderos
```

## What `senderos init` creates

`senderos init` creates the Senderos runtime only after approval. The resulting structure includes:

- config file
- SQLite database or remote DB configuration
- artifact directories
- initial schema
- built-in agent definitions and their default transitions

## Required configuration

The configuration file defines:

- database driver and connection details
- artifact directories
- default harness
- output mode defaults
- guardrail settings

## Manual and scheduled operation

Senderos can always be run manually through the CLI.
If the host environment supports scheduling, the host agent can periodically call the planning/dispatch flow itself.
