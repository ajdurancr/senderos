---
title: How Senderos Works
description: "The main workflow from clarified feature request to tracked implementation and completion."
---

## End-to-end flow

At its core, Senderos manages a sequence like this:

1. **Capture intent**: a user proposes a feature or task.
2. **Clarify and specify**: the spec agent or operator flow resolves ambiguities.
3. **Approve**: the human confirms that the spec matches the intended outcome.
4. **Generate acceptance criteria**: for example as Gherkin scenarios or another durable format.
5. **Queue and validate**: Senderos checks dependencies, readiness, and policy.
6. **Kick off implementation**: a run is created and dispatched to an agent adapter.
7. **Track execution**: sessions, logs, workspace state, and outcomes are persisted.
8. **Reconcile and report**: Senderos refreshes status and exposes it through the CLI.
9. **Complete or recover**: the feature moves forward, gets retried, or is canceled with history intact.

## Control plane vs execution plane

A useful way to think about Senderos is:

- **control plane** = CLI + state + policy + adapters + scheduling,
- **execution plane** = the actual coding agent session doing work in a repo.

Senderos should decide **what is supposed to happen** and **what the current truth is**. The coding agent should perform the implementation work itself.

## Dispatch model

When a feature is kicked off, Senderos should:

1. create a run record,
2. resolve the target repo/workspace,
3. select an agent adapter,
4. launch the session,
5. capture the external session handle,
6. persist run and workspace metadata,
7. update state as progress arrives.

## Reconciliation model

Because external sessions can drift, Senderos also needs a reconciliation path.

That means it can periodically ask:

- Is the session still active?
- Did it fail?
- Did it produce logs or artifacts?
- Did it already push a branch?
- Does the feature need retry, review, or cleanup?

This is why the worker model matters. Senderos should not depend on a user manually babysitting every run.
