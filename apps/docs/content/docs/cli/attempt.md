---
title: attempt
description: "Inspect concrete executions of Senderos runs."
---

A run attempt records the concrete execution context for a run, including its
agent, transition, host-session metadata when available, and optional working path.

```bash
senderos attempt list --run-id <run-id>
senderos attempt show <attempt-id>
senderos attempt update <attempt-id> --status failed --failure-summary "Verification failed"
senderos attempt update <attempt-id> --status succeeded --result-json '{"validated":true}'
senderos attempt resume <attempt-id>
```

`resume` returns recorded resume information; it does not itself resume an
external host-agent session.

Terminal attempt updates also finalize the enclosing run. A failed attempt marks
its goal failed, making it eligible for a retry through `senderos plan` and
`senderos run dispatch --previous-run-id <run-id>`.
