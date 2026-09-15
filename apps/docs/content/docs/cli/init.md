---
title: init
description: "Create the Senderos runtime directory, configuration, and initial database state."
---

`senderos init` is a two-step bootstrap command.

On first run, it previews the exact configuration Senderos will use and requires explicit approval before it creates anything.

## What it does

- requires a globally unique execution-context name and generates its stable ID,
- previews the proposed Senderos home, execution context, libSQL environment-variable configuration, harness, and runtime paths,
- requires explicit approval before writing files,
- creates the Senderos home directory,
- writes the configuration file,
- creates artifact directories,
- defaults `SENDEROS_DATABASE_URL` to a local `file:` database when no URL is set,
- runs the Drizzle migrations and seeds built-in agents.

## Examples

```bash
senderos init --name "My development workspace"
senderos init --name "My development workspace" --home /path/to/.senderos --harness codex
senderos init --name "My development workspace" --execution-context-id context-abc123 --home /path/to/.senderos --harness codex --approve
```

## Typical use cases

Use `init` when:

- setting up a new local environment,
- switching to a new Senderos home directory,
- preparing a clean runtime for a new repository.

The context ID is stored in `.senderos/config.json`. When it is absent there,
commands read `SENDEROS_EXECUTION_CONTEXT_ID`; every command except `init` requires
one of these sources. Supplying `--execution-context-id` reconnects initialization
to an existing context with the same name.
