---
title: CLI Overview
description: "The minimal command surface: small, consistent, machine-readable by default, and built for host-agent planning/dispatch workflows."
---

Senderos keeps the CLI intentionally small.

The command surface is grouped around a few stable nouns instead of a huge list of tiny commands.

## Command groups

```text
senderos init
senderos help [command] [subcommand]
senderos doctor
senderos status
senderos config ...
senderos project ...
senderos feature ...
senderos agent ...
senderos sendero ...
senderos plan ...
senderos run ...
senderos session ...
```

## Design rules

### Small surface area

Every command group exists because it owns a real operational concept.
There are no extra command families for responsibilities Senderos does not own.

### Consistent verbs

Subcommands use predictable verbs such as:

- `create`
- `list`
- `show`
- `update`
- `approve`
- `dispatch`
- `cancel`

### Machine-readable by default

Senderos is optimized for host-agent use.
The default output mode is machine-readable JSON.
Human-readable rendering is the host agent's job when it needs to explain something to a user.

### Command-level help metadata

Each command and subcommand exposes its own help metadata.
That metadata is the source of truth for:

- command discovery
- usage patterns
- expected arguments
- available options
- agent-focused command guidance

Use `senderos help`, `senderos help <command>`, or `senderos help <command> <subcommand>` to inspect it.
Use `--omit-agent-description` to hide the agent-focused guidance when needed.

## Command map

- `init` — preview or create the Senderos runtime.
- `help` — show machine-readable help for commands and subcommands.
- `doctor` — validate the installation and runtime.
- `status` — show the current high-level system state and diagnostics.
- `config` — inspect or update Senderos configuration.
- `project` — create and manage canonical project records.
- `feature` — manage Senderos features.
- `agent` — inspect runtime agent records.
- `sendero` — create and inspect sendero paths.
- `plan` — return the next dispatchable work items.
- `run` — dispatch, inspect, and cancel runs.
- `session` — inspect host-agent execution handles recorded by Senderos.

## Testing surface

The CLI is validated at two levels:

- **unit tests** for command/subcommand branches
- **integration tests** for complete runtime flows

Those integration tests are grouped under `apps/senderos/src/integration/` and are intended to be runnable both locally and in CI.
