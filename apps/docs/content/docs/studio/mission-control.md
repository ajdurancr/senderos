---
title: Mission Control
description: "Author agents and directed workflows, review scoped activations, and inspect host-reported execution through the shared Core contract."
---

Senderos Studio is the human-facing authoring and operational surface over
`@senderos/core`. It uses the same database, validation, publication, and lifecycle
operations as the CLI. It does not launch a model or an external worker session.

## Find a goal or attempt

Open **Search or run a command**, or press **Command/Ctrl + K**. Search by name,
context, project, goal ID or attempt ID. Results use the Studio data already loaded
in the selected scope; this is not a search across every stored record. The palette
shows up to nine matches in their existing order and reports the displayed and
loaded match counts. Refine the query when more matches exist. A known goal or
attempt ID can narrow the list to its loaded record without changing scope.

Select a result to open its owning destination. **Escape** closes the palette and
returns focus to the search trigger. If a record is outside the loaded scope,
close the palette and use the existing context/project selectors before searching
again. Searching and opening records do not dispatch work or change stored state.

## Register a context and project

Open **Settings → Project & database → Set up a workspace**. An execution
context identifies a team or environment; a project groups its goals. Add a
context with a distinct name, then add a project in the selected context. With
multiple contexts, confirm the project's context before submitting. A successful
registration selects the new durable scope and survives a reload. Invalid or
duplicate names show an error without replacing existing records.

Studio creates a named project with repository integration disabled and no
workspace path. This is enough to organize research, writing or other standalone
work. Open **Goals → New goal** and choose a published Sendero to define an
outcome. Registration does not reserve runs or start external execution. Use the
CLI for repository metadata and explicit host/workspace configuration; registering
identities in Studio does not create a checkout or grant filesystem access.

## Configure a project

In **Settings → Project & database**, choose the project scope before editing its
name and integration behavior. With **No repository integration**, a target branch
is optional: leave it empty or keep a branch for later. **GitHub pull request**
and **Local merge** require a nonempty target branch. Switching modes updates the
form requirement immediately; invalid saves preserve the stored configuration.
Changing a project setting does not create a repository, run Git, or deliver an
outcome. Runtime database connection fields remain read-only.

## Author agents and senderos

Use **New agent** to define a name, slug, description, and instructions. Existing
agents can be edited or disabled. Published senderos retain their pinned
instructions; changing the global agent does not rewrite existing goal packets.
Published workflow and goal-node inspectors distinguish the **Pinned agent** from
the **Current agent**. Expand **Pinned instructions** to read the stored policy.
If a legacy or invalid snapshot is unavailable, Studio labels the current definition
as a reference instead of presenting it as the published policy.
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

## Prepare a goal before activation

Open a draft goal in **Workflow progress → Edit goal** to revise its title,
category, specification, or published Sendero. A goal created through Core or the
CLI without a workflow can be assigned one here. Choose a published version
before starting; if none are available, publish a Sendero in Settings first.

**Save goal draft** keeps the goal in draft. **Start goal** is a separate action
that activates its workflow without dispatching runs. After activation its
published version is pinned. Save or cancel preparation before lifecycle actions.

Rejected saves retain inputs. A concurrent edit or activation since review rejects
the save atomically. **Cancel preparation** loads the latest known values.
Dirty preparation uses the same scope/history and document-leave protection as
graph editing. If a save response is lost, Studio preserves inputs and explains
that persistence is unconfirmed; retry retains the reviewed snapshot, or reload
to inspect saved state. Browser crash recovery is not provided.

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
host registration/grants, session reporting and reconciliation.

## Browse attempt history

**Runs** shows 30 attempts per page, newest first. **Older attempts**, **Newer
attempts**, and **Latest attempts** keep the selected context/project in the URL.
Recorded creation time and attempt identity provide stable ordering when several
attempts share a timestamp. Page position survives reloads; an invalid position
or one from another scope returns to the latest page with an explanation.

An exact link to an older attempt opens a page containing it. Selecting an attempt
keeps the history position and focuses its recorded detail, including evidence
and host recovery observations. **Recorded result** shows the host-reported outcome
and summary in both Runs and the linked execution inspector. Expand **Complete
recorded result** for all stored result fields. Result content is separate from
the durable attempt status and review decision; a reported outcome does not
establish acceptance. Missing or unreadable results are identified explicitly. The page count is separate from the complete
scope total. Paging does not change attempts or establish that a worker stopped.

This bounds the visible list. Studio still loads the complete scoped operational
snapshot for planning, attention and inspection; database reads, serialized data
and per-goal activation detail are not yet bounded by this pagination. The
dispatch queue reuses the overview’s lifecycle decisions instead of explaining
each active goal a second time; this does not truncate history or attention.

## Adjust execution budgets

The goal inspector shows persisted activations used, the activation limit, and
attempt usage for each activation. Active goals can change **Activation limit**
or **Attempt limit per activation** independently. Attempts include the first
execution; the limit is not a count of additional retries. Completed activation
records retain their original limits.

Activation limits must cover already-used activations (maximum 10000). Attempt
limits must be whole numbers from 1 to 100. Core validates each change; terminal
goals and cancellation awaiting host acknowledgement are read-only. Draft goals
initialize budgets when started.

Increasing a limit can unblock eligible work, but does not reserve runs or start
workers. Review ready activations and explicitly dispatch the desired work.

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

## Inspect recorded recovery

Open an attempt's Host and session records for its recorded owner, worker,
workspace, heartbeat, lease, and latest recovery observation. The recovery next
step explains whether to inspect, keep blocked, continue an existing session,
confirm termination independently, or wait for cancellation acknowledgement.
These are recorded facts and guidance, not live host checks. Pending completion
requires evidence or review; terminal attempts retain recovery as history.
Recovery remains an explicit host CLI/Core operation. Studio does not reclaim,
abandon, kill a process, or launch replacement work from this panel.

### Browse a goal's visits

Goal and attempt detail keep all unresolved visits visible, including failed,
blocked and waiting branches. Settled visits appear in pages of 30 with Older,
Newer and Latest links. Original visit numbers, pinned workflow labels, parents,
fork generations and recorded next actions remain available. Opening an older
attempt shows its containing history page; an explicit different page retains
that attempt's details and offers a link back to its visit.

This limits displayed settled cards only. Current visits, database reads and the
shared operational snapshot remain complete.

### Compare retry attempts

An attempt's **Attempt history** section links to its recorded previous attempt
and any direct retries. Use these links in Runs or the canvas inspector to compare
failure evidence with a retry's progress. Reload and browser Back/Forward retain
the exact selection. Evidence and host details belong to the viewed attempt;
**Goal summary** describes the goal's current state. A missing previous attempt
is labeled unavailable in the current execution scope. Navigating history does
not dispatch, resume or change execution state.

Studio project requests narrow goals before lifecycle explanation, so unrelated
projects do not incur lifecycle transactions. Project and context navigation
choices remain complete; missing projects or mismatched contexts return an empty
operational scope. The programmatic `missionControl.overview()` remains complete
by default; `missionControl.overview({ projectId })` explicitly narrows its
operational records and status. Existing host inspection permissions are unchanged.
