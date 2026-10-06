---
title: attempt
description: "Inspect concrete executions of Senderos runs."
---

A run attempt records the concrete execution context for a run, including its
agent, transition, host-session metadata when available, and optional working path.

```bash
senderos attempt list --run-id <run-id>
senderos attempt show <attempt-id>
senderos attempt claim <attempt-id> --owner-id <stable-host-id>
senderos attempt heartbeat <attempt-id> --token <claim-token>
senderos attempt update <attempt-id> --token <claim-token> --status succeeded --result-json '{"validated":true}'
senderos attempt evidence <attempt-id> --kind ci --label "CI passed"
senderos attempt review <attempt-id> --status approved --reviewer <name>
senderos attempt resume <attempt-id>
```

Claiming returns a lease, fencing token, and execution packet. Persist the token
before starting the external session, heartbeat while it runs, and include the
token in updates. An expired lease requires explicit reclaim after reconciling the
old session; it does not prove that session stopped.

`resume` only returns recorded information. Cancellation is acknowledged by a
`canceled` update. If a host is gone, use `abandon --confirmed-stopped --reason`
only after independently confirming its process stopped.

Terminal updates atomically finalize the run and advance, retry, cancel, or
complete the goal. Required evidence/review can hold a reported success in
`paused` until Core settles the completion gate.
