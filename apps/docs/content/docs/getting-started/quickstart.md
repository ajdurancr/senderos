---
title: Quickstart
description: "Register a repository, create a durable goal, and move it through planning and dispatch without hiding the host-agent boundary."
---

This walkthrough creates one real planning record from end to end. It assumes you completed [Install & configure](./setup), defined the `senderos` alias, and are inside the repository you want to coordinate.

## 1. Register the project

```bash
senderos project create \
  --home ./.senderos \
  --canonical-path "$PWD" \
  --github-owner your-org \
  --github-repo your-repo
```

Keep the returned project `id`. A project defines the canonical repository path, GitHub identity, target branch, inferred commands, and integration mode used by its goals.

## 2. Create the outcome

```bash
senderos goal create \
  --home ./.senderos \
  --project-id <project-id> \
  --title "Add a health endpoint" \
  --kind feature \
  --spec-text "GET /health returns 200 and a JSON status payload."
```

The goal starts as `draft`. Drafts are durable but not dispatchable, which gives you a clean point to inspect or refine the specification.

## 3. Activate and plan

```bash
senderos goal activate <goal-id> --home ./.senderos
senderos plan --home ./.senderos
```

`plan` is read-only. It evaluates current state and returns the next valid dispatch item:

```json
{
  "goalId": "goal_…",
  "transitionId": "transition_…",
  "agentId": "agent_…",
  "previousRunId": null
}
```

Planning does not start a model session or edit the repository.

## 4. Dispatch the run

Use the identifiers returned by `plan`:

```bash
senderos run dispatch \
  --home ./.senderos \
  --goal-id <goal-id> \
  --transition-id <transition-id> \
  --agent-id <agent-id> \
  --working-path "$PWD"
```

Dispatch creates a logical run and its first concrete attempt. The result includes `runId` and `attemptId`.

## 5. Execute in the host

Now the host agent—OpenClaw, Codex, Claude Code, or another operator—does the actual engineering work in the working path. Senderos does not launch or supervise that model session itself.

As execution progresses, update the attempt with checkpoints, host-session metadata, results, or failure information:

```bash
senderos attempt update <attempt-id> \
  --home ./.senderos \
  --status succeeded \
  --result-json '{"summary":"Endpoint implemented and tests passed"}'
```

## 6. Inspect what Senderos knows

```bash
senderos status --home ./.senderos
senderos run state <goal-id> --home ./.senderos
senderos attempt show <attempt-id> --home ./.senderos
```

If the attempt fails, `plan` can expose a retry path that preserves the previous run and attempt history. If it succeeds and another transition is valid, planning can advance to the next agent.

## The invariant to remember

```text
Senderos decides and records what should run.
The host environment performs the run.
The outcome returns to Senderos as durable state.
```

Next, read [How it works](../core/how-senderos-works) for the lifecycle rules behind this flow or use the [Command overview](../cli/overview) as a reference.
