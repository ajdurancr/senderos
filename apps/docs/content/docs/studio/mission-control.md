---
title: Mission Control
description: "Author agents and directed workflows, review scoped activations, and inspect host-reported execution through the shared Core contract."
---

Senderos Studio is the human-facing authoring and operational surface over
`@senderos/core`. It uses the same database, validation, publication, and lifecycle
operations as the CLI. It does not launch a model or an external worker session.

## Author agents and senderos

Use **New agent** to define a name, slug, description, and instructions. Existing
agents can be edited or disabled. Published senderos retain their pinned
instructions; changing the global agent does not rewrite existing goal packets.
Disabling a definition blocks new execution but does not prevent a running owner
from reporting or acknowledging cancellation.

Use **New Sendero** to create a draft or import a JSON definition. A new empty draft
starts with start/end nodes; it needs an agent and a valid connected graph before
publication. Import also creates a draft, never an automatically executable version.

The draft graph editor supports:

- agent nodes with an execution objective, optional completion policy, and host
  capability requirements;
- directed transitions with exact outcome conditions, multiple outgoing branches,
  and backward edges;
- an activation budget that bounds cycles independently of retries;
- optional explicit fork/join pairs; an ordinary convergence is per-arrival;
- adding/removing nodes and transitions while retaining other nodes' policies.

Save the graph draft before publishing. **Cancel changes** discards unsaved graph
edits. Publication validates the complete graph; invalid topology, conditions or
join pairings produce an error rather than a partially executable version. Existing
goals retain their assigned published version. Save and publish requests carry the
reviewed version and content revision; concurrent graph or agent changes reject a
stale request while preserving local edits for review. Inspector and layout saves
use the same snapshot fence. Canvas positions are presentation
metadata, separate from execution semantics.

See [How Core works](../../core/how-senderos-works) for graph and join semantics.

## Filter and review dispatch

Studio initially displays every execution context and project. Header filters are
stored in the URL as `context` and `project`, so an operational view can be
bookmarked without changing record ownership.

**Dispatch all** submits the exact displayed activation IDs and revisions together
with that scope. Core rechecks the entire reviewed set transactionally. A changed
scope, stale revision, or invalid item rejects the reservation instead of silently
reserving another context's work. Refresh and review a stale plan again.

A dispatch creates queued records. It does not prove that an external worker was
created. The host must still preflight, claim, launch independently, and record its
start through the CLI contract.

## Inspect branches and host records

Goal/attempt inspection shows individual activation visits, parent activations,
fork generations, current decisions, and next actions. A repeated node visit is
not confused with retrying the same activation.

The host/session panel separates **reserved**, **claimed**, and **started** work,
and shows safe owner identity, context, harness, declared capabilities, workspace,
worker/parent session, lease, heartbeat, cancellation and recovery observations.
Recorded preflight explains capability or workspace requirements. Claim tokens are
not included in normal attempt reads or displayed in Studio.

These are host-reported records, not a claim that Studio independently inspected a
process or verified filesystem isolation. An expired lease requires actual host
inspection; it does not prove process death. The CLI remains the interface for
host registration/grants, session reporting, reconciliation and budget operations.

## Lifecycle decisions and review

Mission Control combines dispatchable work, blocked goals, active/failed attempts,
evidence/review and event history. Operators can activate goals, request a stop,
retry eligible failures, and record evidence/review through Core.

Cancellation is a request when work has an owner. The host must stop the external
work and acknowledge it; a multi-branch goal cannot finish cancellation while
another owner still needs to acknowledge. Failed or blocked branches also prevent
the goal from appearing complete just because another branch reached an end.

Reviews may be `pending`, `approved`, `changes_requested`, or `rejected`. Configured
gates can pause requested success until satisfied. Approval records a decision; it
does not push, merge, deploy, purchase, or operate a host session.

## Run Studio locally

From the repository root, point Studio at the same database as the CLI:

Use Bun 1.3+ and Node 24 for the Studio toolchain and production server. The local
verification and CI production smoke use Node 24.

```bash
bun install
SENDEROS_DATABASE_URL=file:/absolute/path/to/senderos.db bun run dev:studio
```

Studio uses the explicit `SENDEROS_DATABASE_URL` environment setting, not a host's
`SENDEROS_HOME` configuration file. A remote libSQL connection also uses
`SENDEROS_DATABASE_AUTH_TOKEN` when required. Do not put authentication tokens in
URLs, screenshots, issue comments or shared logs. Studio prepares the database on
startup; back up an existing database and stop old writers before upgrading.

To build and verify the production artifact before serving your own database:

```bash
bun run build:studio
bun run --cwd apps/studio smoke:production
SENDEROS_DATABASE_URL=file:/absolute/path/to/senderos.db bun run --cwd apps/studio start
```

The build packages the migrations and seed definitions beside the SSR entry point.
The smoke starts the built Node server against a disposable fresh database, checks
SSR routes and emitted assets, and creates an agent and draft through HTTP. It
does not connect to an operator's database or reuse authentication tokens.
