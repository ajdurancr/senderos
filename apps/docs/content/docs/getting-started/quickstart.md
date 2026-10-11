---
title: Quickstart
description: "Create a durable goal, register an eligible host, and report an independent worker through the CLI."
---

For the quickest local demonstration from the source repository, run:

```bash
bun run simulate:host --output .tmp/external-host-report.json
```

This deterministic example needs no API keys. It exercises separate CLI and worker
processes, three simulated tool/machine contexts, distinct local workspaces, and one
local libSQL file. See [Worker and Scheduling](../../automation/worker-and-scheduling)
for what the simulation proves and how to adapt it to a real host.

For your own project, complete [Install & configure](../setup) and use the selected
CLI build consistently. The examples below assume the `senderos` alias is defined.

## 1. Register the project and host

```bash
senderos project create --home ./.senderos \
  --canonical-path "$PWD" --github-owner your-org --github-repo your-repo

senderos host register my-laptop-codex --home ./.senderos \
  --name "My laptop / Codex" --harness codex \
  --capability independent_session --capability shell

senderos host grant my-laptop-codex --home ./.senderos \
  --project-id <project-id> --workspace-ref my-project

senderos host workspace my-laptop-codex --home ./.senderos \
  --project-id <project-id> --available --working-path "$PWD"
```

Keep the returned project ID. Declare only capabilities and paths you actually
verified on this host. A database record cannot create a checkout or a separate
worker session. A generic project can also be created with only `--name`; repository
and GitHub metadata are optional when the workflow is not software development.
Generic projects do not inherit a software workflow: supply an explicit published
`--sendero-version-id` when creating their goals before activation.

## 2. Create and activate the outcome

```bash
senderos goal create --home ./.senderos \
  --id health-endpoint --project-id <project-id> \
  --title "Add a health endpoint" --kind feature \
  --spec-text "GET /health returns 200 and a JSON status payload."

senderos goal activate health-endpoint --home ./.senderos
senderos plan --explain --home ./.senderos
senderos plan --home ./.senderos
```

A goal starts as a draft. Activation uses its selected published sendero version.
You can [author your own agents](../../cli/agent) and [senderos](../../cli/sendero);
the bundled definitions are examples.

Planning may initialize or reconcile lifecycle state, but does not reserve a run,
launch a session, or edit your project. Ready items include a goal, activation,
agent, transition, previous run, and revision. An empty list is not completion;
inspect the explanation for blockers and terminal state.

## 3. Reserve, preflight, and claim

Use the activation and revision returned by planning:

```bash
senderos run dispatch --home ./.senderos \
  --goal-id health-endpoint --activation-id <activation-id> \
  --request-id health-endpoint-first-dispatch --expected-revision <revision>

senderos attempt preflight <attempt-id> --home ./.senderos \
  --owner-id my-laptop-codex

senderos attempt claim <attempt-id> --home ./.senderos \
  --owner-id my-laptop-codex
```

Dispatch returns a run and attempt ID. Reuse the same request ID with unchanged
inputs after an ambiguous dispatch response. Claim returns the execution packet,
lease, and fencing token. Save the token privately before launching anything.
Neither a dispatch nor a claim proves that an external worker is running.

## 4. Start an independent host session

Use your host's own API or UI to start a worker separate from the controller
conversation. Give it the packet and verified local workspace. Then record the
actual identifiers:

```bash
senderos attempt start <attempt-id> --home ./.senderos \
  --token <claim-token> --external-session-id <worker-session-id> \
  --parent-session-id <controller-session-id> --working-path "$PWD"

senderos attempt heartbeat <attempt-id> --home ./.senderos --token <claim-token>
```

The worker and parent session IDs must differ. The host owns real isolation,
execution, tools, permissions, and process inspection. Heartbeat regularly and
honor any cancellation request before acknowledging that work has stopped.

## 5. Report and inspect

```bash
senderos attempt update <attempt-id> --home ./.senderos \
  --token <claim-token> --status succeeded \
  --result-json '{"outcome":"accepted","summary":"Endpoint implemented and tests passed"}'

senderos goal explain health-endpoint --home ./.senderos
senderos run state health-endpoint --home ./.senderos
senderos attempt show <attempt-id> --home ./.senderos
```

Core applies configured evidence/review gates and selects every matching outgoing
edge. Each graph visit has an activation; one branch finishing does not finish
other branches. Keep asking Core until the goal is explicitly completed or a
blocker needs attention. If a lease expires, inspect and reconcile the existing
worker before reclaiming or abandoning it; do not blindly launch a duplicate.
