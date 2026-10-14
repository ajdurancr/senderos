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
- Empty scopes, project choice, missing goal/attempt, command search/no results,
  keyboard/Escape/focus restoration, narrow drawer, configuration tabs, long
  labels, and a real isolated database-open error were inspected.

Each mutating journey was checked against the local database, including invalid
and canceled submissions. The external manual journal retains the detailed
before/after evidence; test fixtures do not rely on that database.

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
