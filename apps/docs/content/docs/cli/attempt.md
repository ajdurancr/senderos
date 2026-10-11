---
title: attempt
description: "Claim, start, heartbeat, report, and safely reconcile independent external workers."
---

An attempt records one concrete host execution for a durable activation. A queued
reservation, claimed ownership, and a recorded started session are different states.

```bash
senderos attempt list --run-id <run-id>
senderos attempt show <attempt-id>
senderos attempt preflight <attempt-id> --owner-id <host-id>
senderos attempt claim <attempt-id> --owner-id <host-id>
senderos attempt start <attempt-id> --token <claim-token> \
  --external-session-id <worker-id> --parent-session-id <controller-id> \
  --working-path /host/local/checkout
senderos attempt heartbeat <attempt-id> --token <claim-token>
senderos attempt update <attempt-id> --token <claim-token> --status succeeded \
  --result-json '{"outcome":"accepted","validated":true}'
senderos attempt evidence <attempt-id> --token <claim-token> --kind ci --label "CI passed"
senderos attempt review <attempt-id> --status approved --reviewer <name>
senderos attempt resume <attempt-id>
```

Preflight checks declared capabilities, grants, and local workspace availability.
Claim returns a lease, token, and execution packet. Persist the token privately
before launching. Start requires distinct worker and parent session IDs plus the
host-declared path. Core validates the records; the host provides real isolation.

Heartbeats renew ownership and return cancellation requests. Stop actual work
before acknowledging `canceled`. Terminal reports settle the run and activation;
configured evidence/review can keep a success in `paused`. Pending completion
freezes its result and cannot be changed back to running; retry after a failure or
rejected review instead. An assigned cross-context
host can attach evidence with its current token; operator review remains in the
project-owning context. Revoking a grant or disabling a host blocks new work but
lets an existing owner heartbeat, report, reconcile, and acknowledge cancellation
so it can stop or finish safely. It does not kill the worker.

## Reconciliation

```bash
senderos attempt reconcile <attempt-id> --owner-id <host-id> \
  --outcome active --external-session-id <worker-id> --details "Session verified active"
senderos attempt claim <attempt-id> --owner-id <host-id> --reclaim
```

Inspect the external session first. Record `active`, `finished`, `missing`, or
`unknown`; unknown remains blocked. A finished observation includes its terminal
`--status` and recovered `--result-json`. Missing work needs independently confirmed
termination before `attempt abandon --confirmed-stopped --reason <text>`; a remote
host also supplies its current ownership token.

Reclaim rotates the fence; stale reports fail. Expiry alone never proves process
death. `resume` only returns information, and `abandon` does not kill a process.
Inspect host, session, workspace, and ownership before using recorded resume text.
