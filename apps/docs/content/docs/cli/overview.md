---
title: Command overview
description: "The complete Senderos CLI surface: predictable command groups, generated help, JSON output, and a strict boundary from host execution."
---

The `senderos` CLI is the primary public operating surface. It is intentionally small, machine-readable by default, and grouped around persisted domain concepts.

## Command map

| Command | Purpose | Mutates state? |
| --- | --- | --- |
| `init` | Preview or create the runtime home and database | With `--approve` |
| `bootstrap-agent-skill` | Print or write a host-agent operator skill scaffold | Unless `--print` |
| `doctor` | Validate config, storage, paths, schema, and harness readiness | No |
| `status` | Summarize active goals, runs, and attempts | No |
| `config` | Inspect or update runtime configuration | `set` only |
| `project` | Register and manage repository records | `create`, `update` |
| `goal` | Create and manage durable outcomes | Except `list`, `show` |
| `agent` | Inspect persisted agent definitions | No |
| `transition` | Create and inspect allowed agent handoffs | `create` only |
| `plan` | Return the next dispatchable work | No |
| `run` | Dispatch, inspect, or cancel logical executions | `dispatch`, `cancel` |
| `attempt` | Inspect and update concrete executions | `update` |

## Discover commands from the CLI

Command metadata is generated from the same definitions used by the CLI:

```bash
senderos help
senderos help run
senderos help run dispatch
senderos help --omit-agent-description
```

Help includes usage, arguments, options, subcommands, and agent-focused guidance where relevant. When documentation and help ever disagree, use the installed CLI help for the exact version you are running.

## Output contract

Commands print JSON. That default is deliberate: host agents should consume stable fields and render a human explanation appropriate to their own surface.

Errors are also emitted as JSON:

```json
{
  "error": "Goal not found: goal_…"
}
```

A failed command sets a non-zero process exit code.

## Common operating sequence

```bash
senderos init --approve
senderos doctor
senderos project create --canonical-path /repo --github-owner owner --github-repo repo
senderos goal create --project-id <project-id> --title "Outcome" --kind feature
senderos goal activate <goal-id>
senderos plan
senderos run dispatch --goal-id <goal-id> --transition-id <transition-id> --agent-id <agent-id>
senderos attempt update <attempt-id> --status succeeded --result-json '{"verified":true}'
senderos status
```

## Global home selection

Commands that load runtime state accept `--home` through the shared CLI parser:

```bash
senderos status --home /absolute/path/.senderos
```

Without it, Senderos resolves `.senderos` from the current working directory.

## What the CLI will not do

The CLI does not launch a model, edit product code, create a Git worktree, push a branch, open a pull request, or install a scheduler. It creates and queries orchestration state. The host agent performs external work after a validated dispatch.
