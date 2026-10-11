---
title: Install & configure
description: "Run the Senderos implementation from source, initialize its runtime home, and verify that storage and harness detection are healthy."
---

These instructions run the selected source checkout directly. Published registry versions may expose a different contract; use the checked-out CLI consistently when evaluating these graph and host features.

## Prerequisites

- [Bun](https://bun.sh/) `1.3` or newer
- Git
- a host-agent environment such as OpenClaw, Codex, Claude Code, Cursor, or another harness
- a goal or workspace to coordinate; repository integration is optional

## Install from source

```bash
git clone https://github.com/ajdurancr/senderos.git
cd senderos
bun install
```

For shorter commands that keep working after you change directories, define a shell-local function:

```bash
SENDEROS_SOURCE="$PWD"
senderos() { bun run "$SENDEROS_SOURCE/packages/cli/src/index.ts" "$@"; }
senderos help
```

The function is only a convenience. It does not install or modify Senderos globally.

## Preview initialization

Senderos keeps its own state in a runtime home. From the workspace you want to operate, first preview the configuration with the shell function created above:

```bash
senderos init \
  --name "My development workspace" \
  --home ./.senderos \
  --harness codex
```

Preset harness values are `openclaw`, `codex`, `claude-code`, and `cursor`. These are suggestions, not a whitelist: `--harness` accepts any non-empty identifier so new or private harnesses do not require a Senderos release. Senderos attempts to infer known environments, but an explicit value is required if inference returns `unknown`.

The preview reports:

- the resolved Senderos home;
- the configuration path;
- managed artifact, log, and cache directories;
- the database URL environment variable;
- the inferred or selected harness.

Nothing is created until you approve it.

## Create the runtime

Repeat the command with `--approve`:

```bash
senderos init --name "My development workspace" --home ./.senderos --harness codex --approve
```

Initialization registers the named execution context, creates the config and managed directories, runs database migrations, and seeds the built-in agent definitions and transitions.

The default layout is:

```text
.senderos/
  config.json
  senderos.db
  artifacts/
  logs/
  cache/
```

## Verify the environment

```bash
senderos doctor --home ./.senderos
senderos status --home ./.senderos
```

`doctor` validates configuration, database connectivity, schema availability, managed directories, guardrails, and harness readiness. Fix any reported failure before dispatching work.

## Local and remote storage

When `SENDEROS_DATABASE_URL` is unset, initialization uses a local database under the runtime home:

```bash
export SENDEROS_DATABASE_URL='file:/absolute/path/.senderos/senderos.db'
```

For remote libSQL, set the configured URL and optional token before running commands:

```bash
export SENDEROS_DATABASE_URL='libsql://your-database.turso.io'
export SENDEROS_DATABASE_AUTH_TOKEN='…'
```

The config stores the *names* of those variables, not their secret values.

## Next step

Continue to the [Quickstart](../quickstart) to register a project, create a goal, ask Senderos what can run, and dispatch the first attempt.
