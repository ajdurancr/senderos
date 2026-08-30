---
title: attempt
description: "Inspect concrete executions of Senderos runs."
---

A run attempt records the concrete execution context for a run, including its
agent, transition, host-session metadata when available, and optional working path.

```bash
senderos attempt list --run-id <run-id>
senderos attempt show <attempt-id>
senderos attempt resume <attempt-id>
```

`resume` returns recorded resume information; it does not itself resume an
external host-agent session.
