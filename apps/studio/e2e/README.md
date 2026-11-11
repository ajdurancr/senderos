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
real database and fresh page reloads. No request routes or persistence APIs are
mocked. External execution is deterministic: the fixture uses genuine core host
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
