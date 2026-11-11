# Real Studio browser journeys

Run `bun run --cwd apps/studio test:e2e`. The command builds Studio and launches
Playwright Chromium against a dedicated production server with a fresh local
SQLite database. Run `bunx playwright install chromium` in `apps/studio` first.
For an already installed Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
`STUDIO_E2E_PORT` optionally changes the default port 4179. An existing server is
never reused. All test runtime files are isolated under `.tmp/test-runtime` and
removed when the server exits. Reports/traces are under
`apps/studio/.tmp/studio-e2e`.

Each test creates its own execution contexts and projects through core.
Nonauthoring tests explicitly use the built-in published workflow and do not
depend on the authoring or settings tests.
Agents, workflow imports and edits, publication, goals, activation, reviewed
reservation, evidence, review, settings, and cancellation are actual browser
form submissions to Studio. Each meaningful boundary is verified against the
real database and fresh page reloads. Successful requests and persistence APIs are
not mocked; the graph navigation journey below injects transport failures. External execution is deterministic: the fixture uses genuine core host
registration, workspace grant/declaration, preflight, claim, independent-session
start, completion, and typed evidence contracts, without contacting any model,
remote host, repository provider, or deployment service.

The suite also checks stale concurrent revision rejection, invalid/canceled
forms, project/context isolation, scope-aware keyboard search, focus trapping
and restoration, narrow desktop/mobile overflow, terminal read-only evidence,
missing entities, and browser hydration/runtime errors. CI retains Playwright
reports, failure traces/screenshots, and redacted database assertions.

Cancellation is goal-wide and requires confirmation. The browser suite verifies
canceling before dispatch creates no runs or attempts, dismissing confirmation
does not change activations, and canceling an unclaimed reservation survives a
reload. Real-database integration tests also cover failed-attempt preservation
and waiting for all parallel host acknowledgements.

Execution budget recovery authors a two-step bounded workflow, exhausts one
activation's attempt limit through the simulated host contract, raises each limit
through the real Studio form, and explicitly reviews/dispatches restored work.
It verifies native form rejection without writes, persisted usage/revisions after
reload, zero automatic reservations, desktop/mobile overflow, and terminal
read-only state. No worker/model calls are made.

The failure-attention journey verifies that a reserved retry removes only its
superseded failure from Now, an independently failed sibling remains visible,
and both failures remain in scoped Runs after recovery and reload. Its host
reports use the same isolated fixture boundary; it captures desktop/mobile Now.

`settings.pw.ts` exercises a standalone project with an empty branch, conditional
requirements when enabling repository integration, a server-rejected whitespace
branch with no persisted mutation, valid local integration, and returning to no
integration. Database assertions and reloads verify each successful save and
scope isolation. Desktop/mobile screenshots capture the real settings form.

`registration.pw.ts` creates a context and standalone project through Studio,
starting with an unrelated selected scope. It verifies whitespace/duplicate
errors without writes, the new context/project URL, persistence after reload,
unchanged prior projects/goals/runs/claims, and desktop/mobile onboarding.

`recovery.pw.ts` records unknown, missing, and active session inspections through
the isolated host fixture. Actual production pages retain observations on reload,
show outcome-specific next steps, and do not mutate claims or reserve replacement
work. A real Studio cancellation waits for simulated host acknowledgement before
the panel presents settled history. Screenshots capture desktop/mobile guidance.


`activity.pw.ts` verifies production activity pagination at 50 events per page,
keyboard/anchor focus, stable reloads, complete detail disclosures, invalid-cursor
recovery, empty states, and context/project isolation. Its fixture inserts 125
synthetic observations after the real unknown-host recovery observation, so that
recovery falls outside the bounded latest event page. The attempt inspector must
still show durable recovery details and guidance. Browsing leaves events, claims,
attempts and runs unchanged. Desktop/mobile screenshots cover the real history UI.

The settings scope-switch journey also reloads the selected context, captures its
real desktop/mobile form, and returns to the prior context to choose a project.
Navigation choices must remain available when HTTP operational data is scoped.

Project-only settings paths are also reloaded and captured at desktop/mobile
sizes before switching to another project. Scoped loading must retain navigation
choices and saved form values without needing an explicit context query.

The operator acceptance journey records manual evidence first and verifies that
it cannot satisfy a required test gate. After the simulated host requests
completion, the operator records explicit test proof and a summary through
Studio. Reloaded database state proves the gate settled and the terminal record
retained its kind, URL and summary. Desktop/mobile screenshots show the native
kind selector and summary form. This does not execute or independently verify
the operator-supplied test report.

Completion guidance uses a test-and-artifact gate in the operator journey. The
browser checks the exact missing prerequisites, records test evidence, reloads
with only artifact still missing, and records artifact proof before confirming
terminal completion and removal of the checklist. Both narrow mobile and desktop
captures preserve the real read-only guidance.

The operator journey also checks that Reviews identifies newly added evidence using its persisted creation time, including after reload. Desktop and mobile captures preserve the rendered card; the suite checks horizontal overflow at 390 pixels.

The parallel-attempt draft journey checks that selecting another project scope clears unsaved evidence and review inputs without database writes. A rejected HTTP-link submission preserves inputs on the same attempt. Actual proof and review writes remain attached to the selected attempt after reload; desktop/mobile captures preserve the blank second-attempt forms.

## Unsaved graph navigation and save interruption

`draft-navigation.pw.ts` exercises Project and Execution context changes, Back
and Forward, native document-leave confirmation, keyboard focus and Escape,
and explicit leaving after unsaved changes. Staying retains valid graph inputs
and the selected scope without writes. Saving restores normal navigation.
Desktop/mobile screenshots capture the actual confirmation dialog.

This journey also deliberately delays a real save response and aborts requests
before the server and responses after persistence. These are transport fault
injections, not mocked successful saves. Unconfirmed saves retain graph inputs
and the original concurrency revision. A retry after an applied but lost response
is rejected as stale; canceling then loads the latest revalidated graph. The
test verifies saved values again after reload. It does not simulate real external
hosts, remote database outages, or browser-process crashes.

## Draft goal preparation

`draft-goal.pw.ts` creates a goal through Studio and prepares its title, category,
specification and published workflow. It checks rejected/canceled saves without
writes, reload persistence, two-editor stale rejection, and separate activation
with no dispatch. A Core-created unassigned draft exercises assignment and scope
navigation protection. Transport faults before request delivery and after real
persistence preserve inputs without manufacturing successful saves. Authentic
desktop/mobile captures include the form and its actions.

## Attempt history navigation

`run-history.pw.ts` places 125 synthetic terminal records after one real isolated
reservation/claim/start and unknown-recovery observation. It browses every older
page, returns newer, reloads selected records, checks exact old-attempt detail,
invalid/cross-scope positions and empty scopes, and compares persisted state
before and after browsing. It captures actual desktop/mobile lists and checks
keyboard focus. Fixture records are synthetic history, not real executions.

`activation-history.pw.ts` checks settled visit browsing alongside unresolved
recovery work. It reserves/claims/starts/reconciles one isolated attempt, then
inserts 125 labeled synthetic settled graph visits through
`prepare-activation-history`. This fixture does not claim real loop executions.
The browser checks page traversal, exact old selection/evidence, latest and return
navigation, reload persistence, keyboard focus, mobile layout and an unchanged
full database snapshot. Desktop/mobile captures preserve the actual UI.

The failure-attention journey also navigates between a failed attempt and its
persisted retry in Runs and the canvas inspector. It checks reload, Back/Forward,
exact-attempt guidance, mobile touch targets and unchanged attempts/events while
browsing. `retry-history-desktop-1440x1000` and
`retry-history-mobile-390x844` capture these production views.


The missing-cursor recovery journey changes a ready successor's attempt budget
through Studio, then uses an explicit isolated fixture to remove only the
aggregate cursor and reverse identical retained activation rows. Production
reloads must reconstruct the saved budget without changing runs or attempts.
Reviewed dispatch uses that budget, simulated host completion settles the goal,
and desktop/mobile captures retain the operator budget view. No external worker
or model is contacted.

The cursor-policy journey also checks the saved activation limit. A separate
pending-cancellation journey requests a stop through Studio while a simulated
local host owns the attempt, then removes only the aggregate cursor. Reload must
keep cancellation pending, hide budget edits and dispatch, preserve every claim,
activation, run and attempt, and wait for host acknowledgement before settling.
`cursor-policy-cancellation-desktop-1440x1000` and
`cursor-policy-cancellation-mobile-390x844` capture the recovered guidance.

The recovered-successor journey also distinguishes a new activation's first run
from retries on the same activation. A successful parent remains recorded lineage
and must not make the successor a retry. The budget journey separately checks a
real failed activation's retry label. `dispatch-successor-desktop-1440x1000` and
`dispatch-successor-mobile-390x844` preserve the reviewed production plan.

The cancellation recovery journey also covers the supported pre-activation legacy
shape: the isolated fixture removes aggregate/activation rows and clears run
activation links. The saved activation limit of 150 must survive migration,
claims and attempt payloads remain unchanged, the retained run attaches to one
reconstructed activation, and cancellation still waits for host acknowledgement.
`legacy-cursor-policy-cancellation-desktop-1440x1000` and its mobile counterpart
capture the pending guidance after that production reload.

The legacy retry-policy journey saves an attempt limit after the first reservation,
then reconstructs the legacy cursor. A limit of 1 must keep the failed activation
blocked; a later limit of 8 must survive the same recovery and allow a reviewed
retry with its predecessor intact. Neither recovery changes attempt/claim
payloads or creates a run. `legacy-retry-policy-desktop-1440x1000` and its mobile
counterpart capture the restored budget controls before dispatch.

The snapshot freshness journey ages a real active-session observation, expires
only its isolated fixture lease, and explicitly refreshes the scoped production
page. It checks updated recovery guidance without new claims, attempts, runs or
events. An injected refresh transport failure retains the previous timestamp and
unsaved agent input, presents an error, and allows a successful real-server
retry. Desktop/mobile captures cover stale, refreshed and failed-refresh states.

The snapshot contention journey holds an exclusive lock in a separate process
against only the suite database, then requests the real production snapshot at
desktop and mobile widths. The brief lock must resolve without a failed response
or any change to persisted facts. Authentic `snapshot-contention-*` captures
retain the reloaded page. Persistent lock failures are covered in Core and still
propagate after the bounded read wait; this does not establish the cause of an
earlier external-host simulator timeout.

Lease-expiry setup uses Core's existing atomic writer path. A retained isolated
probe reproduced the previous raw fixture UPDATE failing while a reader held the
file; transaction rollback/retry lets that fixture wait without weakening the
production assertions or changing application mutation behavior.

The cold-preparation journey starts a separate real Node production server for
each desktop/mobile viewport without warming it with an HTTP health request.
A separate fixture process then holds a brief exclusive SQLite lock during the
first browser navigation. The journey checks successful hydration and reload,
complete persisted-state equality, responsive width and authentic screenshots.
Only isolated local fixture processes participate; no external host is called.


The snapshot-session journey requests six concurrent production snapshots at
each desktop/mobile size, compares complete scoped results, refreshes the actual
mounted interface, reloads and checks complete persisted-state equality. It
captures the rendered interface. Client closure and interrupted-sibling ordering
are verified by driver-instrumented server regressions; browser success alone is
not evidence of handle cleanup or an explanation for previous simulator stalls.
