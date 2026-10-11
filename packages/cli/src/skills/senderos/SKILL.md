---
name: senderos
description: Use Senderos through its CLI to coordinate work, discover supported workflows and actions, and inspect their current guidance before deciding what to do.
---

# Senderos

Senderos is an orchestration system for turning intent into structured, observable work. Its CLI is the interface for people and agents to discover workflows, perform actions, and inspect current state.

At the beginning of each session, inspect the help for the Senderos build selected for that environment. Do this only once per session. For the published package, run `bunx --bun senderos@latest --help` once, then reuse that resolved version throughout the session. For a source checkout or an unreleased change, run `bun packages/cli/src/index.ts --help` from the repository root and keep using that checkout. Do not replace a locally tested build with a published release mid-session.

Use the CLI help as the source of truth. Start with the top-level help to discover workflows, then inspect the help for the relevant command before acting. Prefer the command's current descriptions, options, and guidance over assumptions or remembered syntax.

Choose the workflow and action that fit the user's intent and the current state. Ask for human input when a decision requires judgment or approval. After acting, report the meaningful result and any remaining decision or next step.

Do not assume a particular agent harness, filesystem location, runtime configuration, project structure, or execution environment.

## Execution lifecycle

Use `plan --explain`, `goal explain`, and `host discover` to understand readiness
and blockers. Planning can initialize/reconcile lifecycle state but never launches
work. An empty ready list is not proof of completion.

Register the host's real tool/machine identity, harness, and capabilities. Obtain
an explicit project grant, verify the host-local workspace, and declare its local
path. Shared coordination state does not synchronize files. Missing capabilities,
including the ability to create an independent worker, must produce a preflight
blocker rather than an invented execution path.

Reserve one Core-selected activation with its activation ID, revision, and a
stable request ID. Run preflight, claim it, and persist the fencing token before
launching. Deduplicate external launches by attempt ID. Start a separate worker
session and record it with `attempt start`, a different parent session ID, and the
verified local working path. A reservation or claim alone is not a started worker.
Follow the returned packet, heartbeat, and report with the current token.

Core evaluates structured `result.outcome` conditions and enables all matching
edges. Each cycle visit has a fresh activation; retries retain the same visit.
Respect the configured activation and retry budgets. Ordinary convergence is
per-arrival; use an explicit fork-paired join when aggregation is intended. Never
add host-side graph routing to bypass a blocked Core decision.

Configured evidence/review may hold completion in `paused`; neither a Judge nor a
review is universally required. Ask Core again after reporting, rather than
inferring completion from one branch or an empty ready list.

## Recovery and cancellation

If cancellation is requested, stop the external work and acknowledge `canceled`.
Never infer that a process stopped from lease expiry. Inspect the actual session
and record `active`, `finished`, `missing`, or `unknown` with `attempt reconcile`.
Unknown stays blocked. Recover a finished result without relaunching; reclaim a
verified active session with a new fence. Explicitly abandon missing work only
after independently confirming the old process stopped.

`attempt resume` returns information, not an executed command. Recheck current
ownership, host identity, workspace, and session before using it. Keep tokens out
of public logs and reports. Core's database fencing does not guarantee exactly-once
external side effects; the host must deduplicate those actions too.

## Authoring

Create or import custom agents and senderos through the CLI. Edit drafts and
publish validated graphs. Existing goals retain their published topology and
snapshotted instructions after later agent edits or publication. Upgrade-time
snapshots of old publications preserve the then-current instructions, not an
unrecorded historical version. Inspect help for
the current authoring schema and never assume bundled examples are mandatory.

## Local adapter acceptance

From the source repository, `bun run simulate:host --output .tmp/host-report.json`
runs the deterministic CLI-only example without API keys. It creates three
simulated tool/machine contexts, independent worker processes, separate workspace
paths, and one shared local libSQL file. It does not certify a real external
harness, remote database, or physical-machine isolation.
