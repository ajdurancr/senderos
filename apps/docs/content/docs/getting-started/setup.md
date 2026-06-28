---
title: Setup and First Run
description: "How Senderos is installed, configured, and started in a real environment."
---

Senderos is installed into the local environment and operated through the CLI.

## First-run flow

1. install the CLI,
2. run `senderos init`,
3. review the generated configuration file,
4. run `senderos doctor --json`,
5. confirm database connectivity,
6. create the first feature,
7. start the loop.

## Example

```bash
senderos init
senderos doctor --json
senderos feature create --title "Add billing portal"
senderos loop start feature-001
senderos status --json
```

## What `senderos init` creates

`senderos init` creates the Senderos home directory and the minimum runtime structure:

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
