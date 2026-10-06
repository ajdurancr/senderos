---
name: senderos
description: Use Senderos through its CLI to coordinate work, discover supported workflows and actions, and inspect their current guidance before deciding what to do.
---

# Senderos

Senderos is an orchestration system for turning intent into structured, observable work. Its CLI is the interface for people and agents to discover workflows, perform actions, and inspect current state.

At the beginning of each session, before any other Senderos operation, run `bunx --bun senderos@latest --help`. This forces Bun to fetch and run the latest published CLI while also exposing its current top-level guidance. Do this only once per session. Reuse that resolved CLI version for every later Senderos operation in the same session; do not refresh it again during the session.

Use the CLI help as the source of truth. Start with the top-level help to discover workflows, then inspect the help for the relevant command before acting. Prefer the command's current descriptions, options, and guidance over assumptions or remembered syntax.

Choose the workflow and action that fit the user's intent and the current state. Ask for human input when a decision requires judgment or approval. After acting, report the meaningful result and any remaining decision or next step.

Do not assume a particular agent harness, filesystem location, runtime configuration, project structure, or execution environment.

## Execution lifecycle

Use `plan --explain` or `goal explain` to understand readiness and blockers. An empty
plan is not proof of completion. Dispatch one step with a stable request ID, claim
the returned attempt before starting an external session, persist its claim token,
and heartbeat while executing. Follow the returned execution packet and verify
workspace/session availability on the host. Report results with the current token;
Core decides whether to advance, wait for review, retry, or complete the goal.

If cancellation is requested, stop the external work and acknowledge `canceled`.
Never assume lease expiration means a process stopped. Reconcile the old session
before explicitly reclaiming; never blindly launch duplicate external work after
a timeout. Use the attempt ID to deduplicate host-side launches and side effects.

Published workflows are immutable. Create a draft, edit it, then validate and
publish it. Existing goals keep their pinned version. Branching is not supported;
do not invent host-side routing to bypass a blocked Core decision.
