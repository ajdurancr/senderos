---
title: CLI Overview
description: "The minimal command surface: small, consistent, machine-readable by default, and built for host-agent operation."
---

SenderOS keeps the CLI intentionally small.

The command surface is grouped around a few stable nouns instead of a huge list of tiny commands.

## Command groups

```text
senderos init
senderos help [command] [subcommand]
senderos doctor
senderos config ...
senderos project ...
senderos feature ...
senderos loop ...
senderos run ...
senderos session ...
senderos status
senderos reconcile
senderos schedule-plan
```

## Design rules

### Small surface area

Every command group exists because it owns a real operational concept.
There are no extra command families for responsibilities SenderOS does not own.

### Consistent verbs

Subcommands use predictable verbs such as:

- `create`
- `list`
- `show`
- `update`
- `start`
- `resume`
- `cancel`

### Machine-readable by default

SenderOS is optimized for host-agent use.
The default output mode is machine-readable JSON.
Human-readable rendering is the host agent's job when it needs to explain something to a user.

### Command-level help metadata

Each command and subcommand exposes its own help metadata.
That metadata is the source of truth for:

- command discovery,
- usage patterns,
- expected arguments,
- available options.

Use `senderos help`, `senderos help <command>`, or `senderos help <command> <subcommand>` to inspect it.

## Command map

- `init` — preview or create the SenderOS runtime.
- `help` — show machine-readable help for commands and subcommands.
- `doctor` — validate the installation and runtime.
- `config` — inspect or update SenderOS configuration.
- `project` — create and manage canonical project records.
- `feature` — manage SenderOS features.
- `loop` — start, resume, tick, or inspect the engineering loop.
- `run` — inspect execution attempts.
- `session` — inspect host-agent execution handles recorded by SenderOS.
- `status` — show the current high-level system state.
- `reconcile` — repair derived truth when state drifts.
- `schedule-plan` — print scheduling instructions for the host agent.

## Testing surface

The CLI is validated at two levels:

- **unit tests** for command/subcommand branches
- **integration tests** for complete runtime flows

Those integration tests are grouped under `apps/senderos/src/integration/` and are intended to be runnable both locally and in CI.
