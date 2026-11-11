# Operator journey verification

The Studio redesign was manually exercised in a cloud browser against an isolated
local libSQL database before adding the durable regression journeys. Prerequisites
were local execution contexts and projects. Agents, workflows, goals, settings,
evidence, and decisions were created or changed through the visible Studio forms.
External host behavior used the registered-host/preflight/claim/start/report
contracts; no remote database or real worker execution was used.

## Manual coverage

- Agent required fields, creation, active/disabled/archived edits, duplicate slug
  rejection, cancellation, and exact persisted instructions/status.
- Sendero creation/import, malformed JSON, draft editing, quick node/arc edits,
  modern and legacy completion policies, requirements, add/remove cancellation,
  fork/join identity, publishing, concurrent revision rejection, pointer layout,
  and shared auto-layout persistence. Published definitions remained pinned.
- Project A unsaved edits → project B selection → save: only B changed. Required
  fields, repository display, branch, and integration mode were checked in SQL.
- Goal creation/specification/category/version pinning; Start produced ready
  activations with zero reservations; reviewed dispatch Close made no writes;
  Dispatch reserved the exact reviewed identities without claiming a host.
- Real lifecycle contracts distinguished reserved, claimed, and started. Builder
  and reviewer activations remained distinct; retries retained their own prior
  attempt and activation identities. Manual evidence did not satisfy a test gate.
- Request changes, Reject, and Approve persisted exact rationale. Approval before
  host completion did not fabricate completion. Host completion without required
  test evidence paused; qualifying host evidence subsequently settled the goal.
- Reviews → evidence → exact attempt → decision was exercised through navigation,
  with terminal evidence and rationale remaining visible and read-only.
- Unclaimed cancellation settled immediately. Parallel claimed cancellation kept
  both attempts live and the goal blocked until both hosts acknowledged stopping.
- Goal cancellation remains available before the first dispatch and after a
  selected attempt finishes. The confirmation names the goal and covers every
  branch; dismissing it makes no writes. Ready goals cancel without creating a
  run, failed attempt history stays intact, and completed goals reject cancellation.
- Empty scopes, project choice, missing goal/attempt, command search/no results,
  keyboard/Escape/focus restoration, narrow drawer, configuration tabs, long
  labels, and a real isolated database-open error were inspected.

## Goal blockers in Now

Now and the workflow attention rail derive goal blockers from every current Core
activation decision. A goal can remain active or have another ready branch while
one activation is blocked; its aggregate status is not a reliable attention filter.
Each goal appears once with all of its blocked visits, actual goal status, owning
scope, reason, next-step guidance, and links to the exact activation/attempt.
Unavailable agents link to their editor. Recovery, budget changes, and host stop
acknowledgements remain explicit operator/host actions; viewing a blocker never
dispatches work or infers that an external process stopped.

Component tests cover partial blockers, missing explanations, safe error text,
terminal history, scoped counts, unknown filters and filtered empty states.
Real-database tests disable/re-enable an agent, verify invalid remediation makes
no writes, and verify readiness changes without creating a run. Production
browser journeys additionally exercise an independently ready parallel branch,
scope switching, mobile layout, persisted remediation, and activation-budget
exhaustion followed by goal-wide cancellation.

Each mutating journey was checked against the local database, including invalid
and canceled submissions. The external manual journal retains the detailed
before/after evidence; test fixtures do not rely on that database.

## Current failures and recovery history

The failed-attempt attention queue follows each activation independently. A
reserved retry supersedes its prior failed attempt; successful or canceled
activations and completed/canceled goals no longer contribute actionable
failures. A failure in another parallel branch remains visible. All attempts,
including superseded failures, remain unchanged in Runs. Unexplained missing
activation associations remain visible instead of being treated as recovery.

Core regressions cover same-activation retries, repeat failure, parallel sibling
failure, success, cancellation, legacy run associations, newer attempts within a
run, and context isolation. The production-browser journey authors a parallel
workflow, reports failures through isolated host contracts, reserves retries
through Studio, verifies the remaining sibling and persisted history, and
captures desktop/mobile attention states. The failed filter links to scoped run
history and explains why recovered attempts disappear from the decision queue.

## Settings without repository integration

Project names and integration changes can be saved with an empty target branch
when the mode is `none`. The form and server require a nonempty branch for
`github_pr` and `local_merge`. Switching modes preserves the current branch value
so choosing a mode alone does not discard operator input. The form remounts by
project identity to keep unsaved edits from crossing scope boundaries.

Component and real-database regressions cover the previously rejected empty
branch, conditional required state, no-write validation failures, valid local
integration, retained branches, and normalized saved values. The production
browser journey saves and reloads a standalone project, exercises native and
server validation, changes modes both ways, verifies another project is
unchanged, and captures desktop/mobile settings from the actual production app.

## Automated layers

- Component tests cover hierarchy, shared roles, scope links/counts, drawer and
  palette keyboard behavior, hydration readiness, project-form identity, missing
  entities, safe evidence links, malformed metadata, and terminal display.
- `operator-journeys.integration.test.ts` uses an isolated real database for
  authored/pinned definitions, Start, atomic dispatch validation, host lifecycle,
  same-activation retry, evidence/review gates, cancellation, scope isolation,
  and rejected mutation invariants.
- `e2e/operator.pw.ts` drives the built production Studio in Chromium. Its
  database assertions read durable rows, while helper mutations are limited to
  prerequisites and the explicitly simulated external host boundary. CI runs
  these browser journeys separately from unit/integration tests.

See the README for commands. Passing snapshots or component tests alone do not
establish lifecycle correctness; keep the production-browser and real-database
layers when modifying these workflows.

## Local-data onboarding

Studio Settings provides explicit execution-context and standalone-project
registration. Component tests cover required/empty context selection, pending
submission, retained failed input and remounting unsaved input on scope changes.
Real-database tests verify trimmed names, known-context validation, duplicate
rejection, selected-scope redirects, no repository metadata and unchanged host,
goal and run records. The production-browser journey starts in another project,
creates a context and project through actual forms, reloads persisted settings,
checks old filters are replaced and duplicate errors retain operator input, and
captures authentic desktop/mobile screenshots. No host or model is contacted.

## Recorded recovery guidance

Component regressions give current terminal or paused status precedence over old
host observations and expired leases, and cover unknown, missing, active, and
cancellation-pending next actions. The production browser journey uses the real
isolated host contract to record inspections, then verifies their persisted
read-only guidance after reload. Browsing creates no new runs or claim changes.
Cancellation stays running until the simulated host acknowledges it; the terminal
view retains the older active observation as history. Desktop/mobile captures
show the actual recovery panel. No external process or model is contacted.


### Bounded activity history

HTTP Studio loaders read at most 50 event records. Activity offers scope-bound
older/newer keyset links with deterministic timestamp/ID order, a latest link,
and native keyboard focus at the history heading. Scope changes reset the cursor;
invalid positions return to latest with a visible status message. Event details
retain exact IDs, timestamps and full payloads. Legacy Core `listEvents` and
programmatic `missionControlData()` inspection remain complete reads. Host recovery
facts come from durable attempt records before the bounded event fallback.

The focused activity regression and production browser journey cover pagination,
scoping, reloads, keyboard focus, empty/error states and old recovery facts.
Goals, attempts and workflow graphs still use the existing overview loading path;
this change bounds event loading only, not the entire overview response.


### Workflow definition hydration

HTTP loads retain published graph definitions pinned by existing goals, alongside
current published definitions used for selectors. Unreferenced historical graph
nodes/edges are not hydrated. Editable drafts load on Senderos management routes;
programmatic `missionControlData()` retains the full-history inspection contract.
The graph-data regression publishes multiple revisions, keeps a goal on its
original definition and verifies immutable nodes/edges/revision, current selection,
and draft availability. Overview goals/runs/attempts and lightweight version
catalog reads remain unchanged; this is not a complete response-size bound.

### Project settings persistence

Project settings updates commit the settings row and `project.updated` event in
one transaction. The Core regression rejects event insertion with a local SQLite
trigger and verifies the complete original record remains unchanged, then removes
the trigger and saves successfully. Concurrent saves to different fields preserve
both edits and record both events. Existing production settings journeys verify
form validation, context/project isolation and persisted state after reload.

### Execution context loading

HTTP requests with an explicit `context` use the existing context-scoped Core
overview, including lifecycle decisions, executions, queues and status. All project
and context choices remain available to the navigation shell. Requests without a
context and programmatic inspection retain their complete overview contract.
The regression compares selected activation/execution/dispatch records against the
complete view and covers switching, empty and unknown contexts. The production
settings journey switches contexts, reloads, captures desktop/mobile, and returns
to another context to choose a project. This reduces unrelated operational payload;
it does not bound selected-context history or all underlying database work.

HTTP project query/path scopes are applied before operational serialization and
pinned workflow hydration, retaining global navigation choices. A context/project
mismatch or unknown project yields empty operational records and zero scoped
status counts. The shared filter also scopes execution summaries and lifecycle
status IDs/counts. Integration tests compare against complete persisted records;
the production browser covers project-only settings reload and cross-project
navigation with desktop/mobile captures. This reduces payload only; Core still
loads the selected context (or complete overview for project-only URLs) first.

### Attempt inspection query work

Core attempt listing fetches safe claim inspection fields and project/host
visibility in one database query. The regression measures actual client query
calls with unrelated project attempts present, and preserves owner-context reads,
explicit host grants, assigned-host reads after grant withdrawal, missing-parent
exclusion for scoped reads, unscoped inspection and no-claim defaults. Claim
tokens and dispatch packets remain excluded; durable recovery details remain
available. This removes per-attempt query calls, not all scans or history growth.


### Typed operator evidence

Studio evidence entry defaults to manual observations and supports explicit test,
CI, pull-request and artifact proof with an optional summary. Server integration
checks preserve all five kinds and summaries, retain legacy manual submissions,
and reject unknown kinds without changing attempts or events. The production
browser journey first proves manual evidence and approval leave a test-required
completion gate paused, then records test evidence through the actual form and
verifies durable completion after reload. Desktop/mobile form screenshots and
read-only terminal proof are preserved. These are operator-supplied records, not
claims that Studio ran or independently verified the linked tests.


### Completion prerequisite guidance

Core explanations expose only the unmet evidence kinds and review approval for
a completion-pending attempt, resolved from the goal's pinned executable policy.
Regressions cover explicit node policies, legacy edge policies, later publications,
manual evidence that does not satisfy a test requirement, partial evidence,
approval, settlement and cancellation precedence. Ordinary pauses have no
completion checklist. No workflow-gate or access behavior is changed.

The production operator journey requires test and artifact evidence. It verifies
the same precise missing list in Now attention and the selected attempt, records test proof through Studio, reloads while only
artifact remains, then records the artifact and verifies terminal completion
and removal of the guidance. Desktop/mobile screenshots preserve the real
checklist. Component tests reject borrowing another activation's prerequisites
and keep absent facts from being presented as successful completion.

### Evidence review recency

Review cards use the latest valid evidence creation or review decision time, rather than presenting an older execution update as the age of newly recorded proof. Deterministic UI regressions cover out-of-order evidence, later review, legacy dates and malformed timestamps. The production operator journey checks the card’s semantic time against persisted browser-submitted evidence before and after reload, with authentic desktop and mobile captures. No Core lifecycle timestamp is changed.

### Attempt form isolation

A mounted-inspector regression reproduces unsaved evidence and rationale carrying from one parallel attempt to another before the fix. The evidence and review forms now reset at the attempt identity boundary. Component coverage checks all draft fields and select defaults, returning to the prior attempt, same-attempt refresh and rejected submission. The production browser journey authors and dispatches two parallel branches, verifies same-attempt validation recovery, changes the selected project scope at desktop/mobile widths without writes, and records proof and a decision only for the intended second attempt.

### Evidence recording feedback

Evidence success feedback stays accurate for every supported kind: manual, test, CI, pull request and artifact. Route-action integration coverage verifies the returned message and persisted kind. The production operator journey checks typed test and artifact feedback against remaining prerequisites and final settlement, with desktop/mobile captures. Recording evidence does not independently execute tests or verify proof contents.

### Unsaved workflow selection

Mounted overview coverage verifies that editing a graph disables the workflow selector and exposes save-or-cancel guidance, then cancellation restores selection. The production authoring journey checks the same state on desktop and mobile, confirms the unsaved budget remains absent from the database, and verifies selection returns after both cancel and successful save. This covers the explicit workflow selector, not arbitrary browser navigation.

## Graph draft navigation recovery

Production browser regressions cover canceled scope/history navigation, native
document-leave confirmation, confirmed leaving, and navigation during a pending
save. Inputs remain intact when the operator stays. Transport fault injection
also covers a save request that never reaches Studio and an applied save whose
response is lost. Retry preserves revision checks and cannot overwrite a newer
saved graph; revalidation and Cancel recover the latest persisted value. These
checks use local isolated data and retain desktop/mobile confirmation captures.

## Draft goal preparation

Mounted tests exercise rejected edits, cancel behavior, reviewed snapshots,
successful saves, and unassigned/empty workflow guidance. Real database tests
check scope isolation, invalid snapshots and values, published-version validation,
stale preparation and activation after review. Those rejected actions make no
persisted changes. Core regressions cover the optional atomic preparation fence
without changing the general metadata-update contract.

The production browser journey edits all preparation fields, cancels and reloads,
assigns an initially unassigned goal, and saves competing proposals from two real
editors. Saving does not activate or reserve runs. Separate fault injection drops
requests before the server and responses after persistence; inputs remain visible
and a stale retry is rejected. Desktop/mobile captures show the actual form.

## Bounded attempt list

A mounted baseline reproduced 125 rendered attempt links. The Runs list now
renders at most 30, while retaining the complete operational data for attention,
planning, evidence and recovery. Pure regressions cover stable ordering for tied
timestamps, older/newer traversal, new/deleted boundary records, exact old-attempt
links, malformed positions and scope changes. Mounted tests retain native link
semantics, selection, empty/missing records, and off-page detail. Production
browser coverage uses 126 persisted records, keyboard navigation, reloads and
unchanged database assertions. This is a presentation bound, not a bounded-query
or bounded-serialization claim. Per-goal activation detail also remains complete.
