# Lifecycle contract

Core owns eligibility, state transitions, completion, retry limits, ownership and
workflow publication. CLI and Studio call those operations; neither launches an
external agent. There is no resident scheduler.

## Host loop

1. Create a goal (use a stable `--id` to safely replay creation), choose a published
   Sendero version, then activate it. Default selection uses the current default
   Sendero version. Unassigned goals remain drafts until explicitly assigned.
2. Call `senderos plan --explain` or `senderos goal explain <id>`. A goal is
   `ready`, `running`, `blocked`, `draft`, `completed`, or `canceled`; responses
   include a reason and next action. An empty dispatch plan is **not** completion.
3. `senderos run dispatch --goal-id <id> --request-id <stable-request-id>`
   reserves exactly one next step. Optional `--expected-revision` detects stale
   plans. Reusing a request ID with different inputs is rejected. The reservation
   is queued, not proof that any external session has started.
4. `senderos attempt claim <id> --owner-id <stable-host-id>` returns a claim token,
   lease expiration, and execution packet: instructions, objective, completion
   policy, goal specification, prior results/evidence and workspace references.
   Persist the token before launching work. Check that the workspace is available
   **on the executing host**; Core cannot inspect another machine's filesystem.
5. Start the external session. Record `--external-session-id`, `--resume-command`
   and `--working-path` with `attempt update --token <token>`. Renew ownership with
   `attempt heartbeat <id> --token <token>` (default lease: 120 seconds). Heartbeats
   return cancellation requests. Do not execute a stored resume command without
   first confirming current ownership and local workspace/session availability.
6. Report `succeeded`, `failed`, or `canceled` using `attempt update --token`.
   The terminal attempt, run, goal/cursor, timestamps and events update together.
   Repeating the same terminal status/result is safe; conflicting results fail.
7. Ask Core again. Success advances, failure offers a bounded retry, and the last
   successful step completes the goal automatically.

No host should infer the next agent from its own copy of the graph. An explicit
transition/agent passed to dispatch is checked against the current Core decision.

## Recovery and cancellation

- An expired heartbeat is not proof that an external process stopped. No automatic
  relaunch occurs. Inspect the old session before `attempt claim --reclaim`.
- Reclaim rotates the token; reports from the previous owner are rejected.
- A lost claim response can be recovered after expiration using explicit reclaim;
  a live lease is not transferable based only on an owner name.
- Canceling unclaimed queued work is immediate. Canceling claimed/running work
  requests a stop. The goal is blocked until the host acknowledges `canceled`.
- If the host is gone, independently confirm its process stopped, then use
  `attempt abandon <id> --confirmed-stopped --reason <text>`. This fences the old
  owner and records a recoverable failure (or acknowledges pending cancellation).
- Each step has three attempts by default, across distinct run records. An operator
  can explicitly change the budget with `goal retry-budget --max-attempts <n>`.
  A retry success clears the goal's failure and resets the counter for the next step.

Database claims prevent duplicate reservations. They do not provide exactly-once
external side effects: hosts must deduplicate external launches/actions using the
attempt ID and reconcile ambiguous launch responses before starting another session.

## Workflow edits and completion gates

`sendero draft <sendero>` clones the published definition. Agent/connection edits
operate on that draft. `sendero show <sendero> --version <n>` inspects it.
`sendero publish <sendero>` validates the entire executable route and atomically
makes it the default for new goals. Existing goals remain pinned to their version.
Visual node labels and canvas coordinates are presentation metadata; they can
still be edited without changing execution. Executable edges are immutable once
published.

This release supports nonempty linear routes only: one start, one end, no branches,
merges, cycles, dead ends or inactive/missing agents at activation. Unsupported
conditions are rejected, not silently ignored. Published historical versions remain
readable and executable for their existing goals.

Configure a draft step with:

```sh
senderos sendero policy software-delivery --agent judge --require-review --evidence-kind test
```

A success report waits in `paused` until required evidence and approval exist.
`attempt evidence` and `attempt review` reevaluate pending completion in Core.
Rejection/changes requested produces a failed step, eligible for bounded retry.
Evidence is reported by hosts/operators; Core does not independently run tests or
verify that linked external evidence is truthful. Database access is trusted;
execution contexts are isolation rules, not a substitute for authentication.

## Upgrade and compatibility

- Migration `0003_lifecycle` adds cursor, claim and idempotency tables. It does not
  delete execution history. Existing goals are reconciled on first lifecycle access.
  Multiple active runs or missing route positions block rather than silently advance.
- Stop/quiesce old writers before upgrading; old CLI binaries do not implement the
  new guarantees. Back up the database first using your normal database tooling.
- Legacy goals with no Sendero are not silently routed through global transitions.
  Drafts can be assigned a published version. For already-active unassigned legacy
  goals, cancel after stopping external work and create a replacement goal.
- Raw run/attempt record constructors are no longer public Core exports. Use dispatch.
- Existing unclaimed inline callers can still report through `attempt update`.
  Once claimed, every host update requires the current token. New integrations
  should always use claim/heartbeat/report; `resume` only returns information.
- CLI successful output remains JSON for compatibility. Errors add `schemaVersion`,
  `code`, `retryable`, and `nextAction`. Retryable database contention exits 75;
  other errors exit 1. Retry mutations with their original request ID.

## Verification

The hardening integration suite covers end-to-end completion, replay/conflicts,
competing dispatches, stale owners/plans, retries, cancellation acknowledgement,
workflow pinning, approval gates, rollback and execution-context isolation.
Package tests use independent temporary directories so simultaneous suites cannot
delete one another's databases.
