---
title: Install & configure
description: "Run the current Senderos release from source, initialize its runtime home, and verify that storage and harness detection are healthy."
---

Senderos currently runs from its Bun monorepo. It is not yet published as a registry package, so commands in these docs use the CLI TypeScript entry point directly. This is the supported, honest path for `v0.1`.

## Prerequisites

- [Bun](https://bun.sh/) `1.3` or newer
- Git
- a host-agent environment such as OpenClaw, Codex, or Claude Code
- a repository you want Senderos to coordinate

## Install from source

```bash
git clone https://github.com/ajdurancr/senderos.git
cd senderos
bun install
```

For shorter commands during evaluation, define a shell-local alias:

```bash
alias senderos='bun run packages/cli/src/index.ts'
senderos help
```

The alias is only a convenience. It does not install or modify Senderos globally.

## Preview initialization

Senderos keeps its own state in a runtime home. From the repository you want to operate, first preview the configuration with the shell alias created above:

```bash
senderos init \
  --home ./.senderos \
  --harness codex
```

Supported harness values are `openclaw`, `codex`, and `claude-code`. Senderos attempts to infer the harness, but an explicit value is required if inference returns `unknown`.

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
senderos init --home ./.senderos --harness codex --approve
```

Initialization creates the config and managed directories, runs database migrations, and seeds the built-in agent definitions and transitions.

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

Continue to the [Quickstart](./quickstart) to register a project, create a goal, ask Senderos what can run, and dispatch the first attempt.
