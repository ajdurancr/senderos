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
| `db reset` | Rebuild the configured local database with a recovery backup | Exact interactive confirmation only |
| `project` | Register repository or generic workspaces | `create`, `update` |
| `goal` | Create and manage durable outcomes | Except `list`, `show` |
| `agent` | Author and inspect custom agents | `create`, `update`, `import` |
| `transition` | Create and inspect allowed agent handoffs | `create` only |
| `sendero` | Create, import, edit, and publish directed workflows | Draft edits and publication |
| `plan` | Explain and return eligible activations | May initialize/reconcile lifecycle state; never reserves or launches |
| `run` | Dispatch, inspect, or cancel logical executions | `dispatch`, `cancel` |
| `host` | Register capabilities, grants, and local workspaces | Except `list`, `discover` |
| `attempt` | Preflight, claim, start, report, and reconcile workers | Lifecycle operations and reports |

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

The interactive-only `db reset` maintenance command also prints its target and
confirmation prompt on stderr. It is not suitable for unattended host operation.

Errors are also emitted as JSON:

```json
{
  "error": "Goal not found: goal_…"
}
```

Errors also include `schemaVersion`, `code`, `retryable`, and `nextAction`. A failed
command sets a nonzero process exit code. Retryable database contention exits 75;
retry the same mutation with its original request ID and unchanged inputs.

## Common operating sequence

Follow [Quickstart](../../getting-started/quickstart) for the complete command sequence:

1. initialize a runtime, register the project and host, and verify its workspace
2. create/activate a goal with a published workflow
3. plan, reserve an activation with a request ID, and preflight the chosen host
4. claim, persist the fence, launch an independent worker, and record `attempt start`
5. heartbeat, honor cancellation, and report results/evidence with the token
6. ask Core again until completion or an explicit blocker

For a complete local run without API keys, use `bun run simulate:host` from the
source repository. It uses the same public CLI with independent worker processes.

## Global home selection

Commands that load runtime state accept `--home` through the shared CLI parser:

```bash
senderos status --home /absolute/path/.senderos
```

Without it, Senderos resolves `.senderos` from the current working directory.

## What the CLI will not do

The CLI does not launch a model, edit product code, create a Git worktree, push a branch, open a pull request, or install a scheduler. It creates and queries orchestration state. The host agent performs external work after a validated dispatch.
