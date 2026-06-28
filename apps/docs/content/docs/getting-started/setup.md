---
title: Setup and First Run
description: "How SenderOS is installed, configured, and started in a real environment."
---

SenderOS is installed into the local environment and operated through the CLI.

## First-run flow

1. install the CLI,
2. run `senderos init`,
3. inspect the previewed configuration,
4. rerun `senderos init --approve` once the configuration is acceptable,
5. run `senderos doctor`,
6. create the first project,
7. create the first feature,
8. approve the feature,
9. start the loop.

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
senderos feature create \
  --home ./.senderos \
  --project-id senderos-ab12cd34 \
  --title "Add billing portal" \
  --gherkin $'Feature: Billing portal\n  Scenario: Open billing portal\n    Given an authenticated user\n    When they open billing\n    Then they should reach the billing portal'
senderos feature approve feature-001 --home ./.senderos
senderos loop start feature-001 --home ./.senderos
senderos status --home ./.senderos
```

## What `senderos init` creates

`senderos init` creates the SenderOS runtime only after approval. The resulting structure includes:

- config file,
- SQLite database or remote DB configuration,
- artifact directories,
- workspace root,
- initial schema.

## Required configuration

The configuration file defines:

- database driver and connection details,
- workspace root,
- artifact directories,
- default harness,
- output mode defaults,
- guardrail settings.

## Manual and scheduled operation

SenderOS can always be run manually through the CLI.
If the host environment supports scheduling, the host agent can install scheduled jobs from a scheduling plan emitted by SenderOS.
