# The smallest external host you can run locally

From the repository root, with Bun and dependencies installed:

```sh
bun run simulate:host --output .tmp/external-host-report.json
```

No model account, API key, GitHub account, VPS, cron job, or remote database is
needed. The simulation executes the current source CLI in separate processes;
it does not import Core or write SQL. The JSON output reports exact assertions,
scenario results, process identities, and the limits of this test. Failure exits
nonzero. Runtime directories are removed unless `--keep` is supplied.

```sh
# Keep the isolated homes, checkouts, and database for manual investigation.
bun run simulate:host --keep --output .tmp/external-host-report.json

# Run the same acceptance contract through the CLI test suite.
bun test packages/cli/src/integration/external-host-processes.integration.test.ts
```

## Dedicated CI integration job

The `External host contract integration` job in `senderos-ci` runs this same
simulator on pull requests, including changes under `examples/external-host/`.
It uses the repository-pinned Bun version, a fresh local libSQL file, and
isolated temporary host homes/workspaces. The CLI initializes the real schema
and synthetic fixture data; no database server is started. No service credentials
or model calls are needed. A 180-second hard process-group timeout bounds the
disposable controller and descendant workers; runtime directories are cleaned up.

The job retains a JSON report and logs for seven days, including failures and
timeouts. If the simulator cannot write its own report, the runner supplies a
clearly marked failure report. The log records the outer runner exit code, which
also covers failures after scenario reporting during worker cleanup. Only reports
and logs are uploaded, never the database, workspaces, session input, or claim
tokens. Runner shutdown or infrastructure loss
can still prevent artifact upload.

This contract already runs indirectly through CLI coverage. That regression stays
in place: the dedicated job adds a visible CI result, bounded isolated execution,
and retained diagnostics, rather than claiming previously absent coverage.

## What is being simulated

| Context | Tool identity | Capabilities | Workspace |
| --- | --- | --- | --- |
| Laptop / Codex | simulated Codex | independent session, shell | its own directory |
| Laptop / Cursor | simulated Cursor | independent session, browser | its own directory |
| VPS | simulated shell | independent session, shell | its own directory |

These are three declared tool/machine contexts on **one physical machine**. A
worker is a real independent OS process, not a function call pretending to be a
session. The scenario checks its PID, session/parent IDs, current directory, and
host-local marker. Each worker reads/writes only its own workspace. Instructions,
claim tokens, and results travel over standard I/O; worker artifacts are not
implicitly shared. All contexts coordinate through one real local libSQL file.

## Files

- `../../scripts/external-host-simulation.ts`: deterministic scheduler/controller
  and scenario assertions. Uses real CLI processes for every state operation.
- `protocol.ts`: public CLI adapter and token-safe subprocess errors.
- `controller.ts`: external process tracking and standard-I/O messages.
- `worker.ts`: independent worker session that starts, heartbeats, and reports
  through the CLI. It has no model integration.

## Replace the simulated worker with your actual host

Keep the control-plane sequence; change the operations owned by your harness:

1. Inspect your tools and local checkout before registering capabilities and
   declaring workspace availability. Use a distinct host ID per tool/machine.
2. Ask Core for work, select the activation, and dispatch with a stable request ID.
3. Run preflight and claim. Store the token durably before launching a worker.
4. Deduplicate launches by attempt ID using your harness's session API or local
   launch registry. Start a new independent session and pass it the packet.
5. Report its actual session ID, distinct controller ID, and local workspace with
   `attempt start`. Heartbeat while it runs and honor cancellation.
6. Recover ambiguous launches and expired leases by inspecting that same external
   session. Record active, finished, missing, or unknown; unknown stays blocked.
7. Report results/evidence using the current fence. Let Core choose subsequent
   branches or join activations. The adapter does not interpret the graph.

For a real scheduled loop, your scheduler periodically invokes this adapter.
Senderos installs no scheduler. For a remote host, provision its checkout yourself
and use a supported shared database; a laptop path is not a VPS path.

See [the lifecycle contract](../../docs/lifecycle-contract.md) and
[acceptance matrix](../../docs/external-host-acceptance.md) for boundaries and
failure semantics. The simulator validates local process coordination; it does
not prove exactly-once external effects, real Codex/Cursor isolation, network
partition behavior, or remote libSQL deployment reliability.
