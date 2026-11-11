# Senderos Studio

Senderos Studio is the primary user interface for the Senderos platform.

Built with React Router, it provides goal planning, directed Sendero authoring, custom agents, parallel activation monitoring, and evidence review.

Studio is a detached control plane. It does not read a local `.senderos/config.json`
or require `SENDEROS_HOME`. Configure its shared libSQL database directly:

```sh
SENDEROS_DATABASE_URL=libsql://senderos.example.turso.io
SENDEROS_DATABASE_AUTH_TOKEN=...
```

Every CLI or worker instance that points to the same database participates in the
same orchestration system, regardless of its host or local filesystem.

On startup, Studio applies the bundled database migrations and idempotently seeds
the built-in agents. The database identity remains the only shared deployment
dependency.

## First project

In **Settings → Project & database**, use **Set up a workspace** to add an
execution context and a named standalone project. New projects start without
repository integration or a workspace path. The resulting scope is selected in
the URL; create a goal and choose its published Sendero next. This registration
only records database identities. Repository metadata and host grants remain
explicit CLI/operator setup.

## Production verification

From the repository root, with dependencies installed and Node 24 available:

```sh
bun run --cwd apps/studio build
bun run --cwd apps/studio smoke:production
SENDEROS_DATABASE_URL=file:/absolute/path/senderos.db bun run --cwd apps/studio start
```

The build packages migrations and built-in agent/Sendero definitions under
`build/server/`. The production server also needs the installed Studio runtime
dependencies: libSQL and Drizzle stay external so native database loading uses
normal Node package resolution. Do not deploy `build/` alone without those dependencies.

The production smoke starts the actual Node server on an ephemeral local port,
uses a fresh temporary database, checks all main SSR screens and emitted assets,
and creates an agent and Sendero through HTTP. It removes its test database on
exit and explicitly unsets `NODE_PATH` and any database authentication token.

## Browser-to-database E2E verification

Install the test browser once, then run the complete production-browser gate:

```sh
cd apps/studio
bunx playwright install --with-deps chromium
cd ../..
bun run --cwd apps/studio test:e2e
```

`test:e2e` builds the actual production artifact and runs Playwright against a
separate Node server on port 4179. Set `STUDIO_E2E_PORT` to choose another port.
For a Chromium already installed on your machine, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chromium`.
The browser must be allowed to create its normal local process sockets. A
restricted-shell browser launch failure is a blocked check, never a passed test.

The runner creates a fresh SQLite database under `.tmp/test-runtime/studio-e2e-*`.
It never reuses a running Studio instance, an operator database, or a remote
Turso endpoint. Each test gets independent contexts and projects through real core commands.
Nonauthoring tests explicitly select the built-in published software workflow,
so filtered runs do not depend on a prior test;
agents, workflows, publication, goals, dispatch, review, evidence, settings, and
cancellation go through real browser forms. Assertions read the persisted
records directly and verify them again after reload. Normal journeys do not intercept HTTP routes, loaders, or persistence adapters.
The graph-save recovery journey deliberately aborts requests or responses and
delays one response to exercise transport failures; successful saves still use
the actual production server and isolated database.

Only the external worker's execution is simulated. Its registration, workspace
access, preflight, claim, independent-session identity, completion, and typed
evidence use genuine core host contracts. The tests verify that Start reserves
no runs, Dispatch creates unowned queued records, approval cannot fabricate host
completion, and manual evidence cannot satisfy a required `test` gate. They
also cover concurrent revision conflicts, scope switching, keyboard focus,
mobile navigation, overflow, and hydration errors.

The dedicated `studio-browser` CI job installs Chromium and runs this same gate.
Playwright HTML reports, failure screenshots/traces, and token-redacted database
evidence are retained under `apps/studio/.tmp/studio-e2e/`. Runtime databases and
host claim files are deleted after the dedicated server exits. See
[`e2e/README.md`](e2e/README.md) for the fixture boundary and additional details.

## Prepare a draft goal

Open a draft goal in Workflow progress and choose **Edit goal** to revise its
title, category, specification, and published Sendero. Saving preparation keeps
the goal in draft; **Start goal** remains a separate action and does not dispatch
work. A goal created through Core or the CLI without a workflow can be assigned
one here before starting. Published version identity is fixed once activated.

Rejected saves keep local inputs. Concurrent changes and activation after review
are checked atomically; cancel preparation to load the latest values. Navigation
protection covers dirty preparation, and an unconfirmed save preserves inputs
while explaining that the server may have saved. Reload to inspect persisted
state, or retry with the original reviewed snapshot. No browser crash recovery
is promised.

## Snapshot freshness

Studio displays a server snapshot, not a live host connection. The snapshot
indicator names its observation time and warns after one minute that host and
recovery status may have changed. **Refresh status** reloads the current scoped
view without submitting a form. Unsaved editor inputs remain in place on a
successful refresh. Refreshing does not heartbeat, reconcile, stop, or restart a
worker. Lease expiry never proves that an external process stopped.

Explicit status refresh uses a read-only scoped snapshot request. If it fails, Studio keeps the previous snapshot and unsaved editor inputs mounted, shows a retry message, and does not advance the observation time. Navigation and successful saves still load their own snapshots normally.

## Retained evidence references

Evidence inspection and Runs history keep imported local paths, file URLs and
other non-web references visible as plain text under **Recorded reference**.
Studio does not open or fetch those references. HTTP and HTTPS evidence retains
its explicit **Open evidence** link. Terminal proof stays read-only, and viewing
or reloading it does not change the recorded evidence.
