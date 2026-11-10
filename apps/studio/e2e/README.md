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
