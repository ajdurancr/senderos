---
title: plan
description: "Explain durable activations and return eligible reservations without starting external work."
---

```bash
senderos plan
senderos plan --explain
senderos goal explain <goal-id>
senderos plan --goal-status active --goal-status failed
senderos help plan
```

Planning is scoped to the configured execution context. It may initialize or
reconcile durable lifecycle state; it never reserves an attempt, launches a worker,
or performs the goal's external work.

Each ready item includes `goalId`, `activationId`, `transitionId`, `agentId`,
`previousRunId`, and `revision`. One goal can produce multiple items after fan-out.
Use the activation ID to select one and the revision to reject a stale decision
when dispatching. Core still recomputes eligibility transactionally.

`--explain` and `goal explain` include non-ready state, blockers, and suggested next
actions. An empty ready list does not mean completion: work may be owned, waiting
for a join or evidence, out of retry/activation budget, canceled, or otherwise blocked.
A failed attempt retries its existing activation; a backedge creates a new visit.

Cross-context hosts use explicit project grants and `host discover` to see their
eligible assignments. A shared database does not grant unrestricted execution.
