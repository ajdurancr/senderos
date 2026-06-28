---
title: Setup and First Run
description: "How Senderos is installed, configured, and started in a real environment."
---

Senderos is installed into the local environment and operated through the CLI.

## First-run flow

1. install the CLI,
2. run `senderos init`,
3. inspect the previewed configuration,
4. rerun `senderos init --approve` once the configuration is acceptable,
5. run `senderos doctor`,
6. create the first feature,
7. start the loop.

## Example

```bash
senderos init --home ./.senderos --harness codex
senderos init --home ./.senderos --harness codex --approve
senderos doctor
senderos feature create --title "Add billing portal"
senderos loop start feature-001
senderos status
```

## What `senderos init` creates

`senderos init` creates the Senderos runtime only after approval. The resulting structure includes:

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

Senderos can always be run manually through the CLI.
If the host environment supports scheduling, the host agent can install scheduled jobs from a scheduling plan emitted by Senderos.
