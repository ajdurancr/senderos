---
title: init
description: "Create the Senderos runtime directory, configuration, and initial database state."
---

`senderos init` is a two-step bootstrap command.

Initialization publishes `config.json` from the proposed configuration only after
path validation, database migrations, context registration and seeding succeed.
A failed setup preserves an existing configuration byte for byte, and a new home
remains unconfigured. Directories or database setup already completed may remain;
initialization is not a transaction across the filesystem and database. Retry with
the same context ID and name after resolving the reported problem. To rebuild
an existing local database while preserving customized configuration bytes, use
the interactive [`db reset`](../db/) command instead, after stopping all writers.

With the default `restrictToHome` guardrail, initialization validates the decoded
local `file:` URL path, including case-insensitive schemes and existing or dangling
symbolic links. Query options are not part of the filename. A local database must
remain within the canonical Senderos home; encoded traversal and links pointing
outside it are rejected before opening the database. Encoded filenames and links
whose destinations stay inside the home remain supported. This initialization
check does not sandbox other filesystem operations or prevent concurrent changes
to symbolic links. Explicit `restrictToHome: false` configuration retains its
existing unrestricted behavior.

On first run, it previews the exact configuration Senderos will use and requires explicit approval before it creates anything.

## What it does

- requires a globally unique execution-context name and generates its stable ID,
- previews the proposed Senderos home, execution context, libSQL environment-variable configuration, harness, and runtime paths,
- requires explicit approval before writing files,
- creates the Senderos home directory,
- creates artifact directories,
- defaults `SENDEROS_DATABASE_URL` to a local `file:` database when no URL is set,
- runs the Drizzle migrations and seeds built-in agents,
- publishes the configuration file after setup succeeds.

## Examples

```bash
senderos init --name "My development workspace"
senderos init --name "My development workspace" --home /path/to/.senderos --harness codex
senderos init --name "My development workspace" --execution-context-id context-abc123 --home /path/to/.senderos --harness codex --approve
```

`--harness` accepts any non-empty identifier. Senderos suggests `openclaw`,
`codex`, `claude-code`, and `cursor` as presets, while allowing new or private
harnesses without a CLI update.

## Typical use cases

Use `init` when:

- setting up a new local environment,
- switching to a new Senderos home directory,
- preparing a clean runtime for a new repository.

The context ID is stored in `.senderos/config.json`. When it is absent there,
commands read `SENDEROS_EXECUTION_CONTEXT_ID`; every command except `init` requires
one of these sources. Supplying `--execution-context-id` reconnects initialization
to an existing context with the same name.
