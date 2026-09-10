---
title: How Senderos works
description: "The complete loop from a requested outcome to a dispatched external execution, evidence, review, and the next valid handoff."
---

Senderos separates the meaning of work from the environment that performs it. It owns a deterministic orchestration lifecycle; a host agent owns actual repository execution.

## The lifecycle at a glance

```text
Project
  └─ Goal (draft -> active -> completed | failed | blocked | canceled)
       └─ Run (one logical execution)
            └─ Attempt (one concrete host execution)
                 ├─ checkpoints and heartbeat
                 ├─ result or failure
                 ├─ evidence
                 └─ review decision
```

A goal may need several agent transitions. It may also need several runs or attempts before it reaches a verified outcome. Senderos preserves those distinctions instead of flattening everything into a single “task status.”

## 1. Anchor work to a project

A project establishes the repository boundary: canonical path, GitHub identity, target branch, integration mode, inferred setup commands, and health state. Every goal belongs to one project.

This prevents runtime state from becoming detached from the codebase it describes.

## 2. Capture a durable goal

A goal records the requested outcome, its kind, intake context, specification, and optional branch or pull-request linkage. Goals start in `draft`, where they can be clarified without becoming dispatchable.

Activation is the explicit signal that the goal is ready for planning.

## 3. Plan without side effects

`senderos plan` reads current state and selects the next valid agent transition for each dispatchable goal. It returns identifiers—not an execution session:

```json
{
  "goalId": "goal_…",
  "transitionId": "transition_…",
  "agentId": "agent_…",
  "previousRunId": null
}
```

Planning is global and read-only. Repeating it without a state change does not create duplicate runs.

## 4. Dispatch one concrete execution

`senderos run dispatch` validates the goal, transition, agent, and retry linkage before creating a run and its first attempt. The attempt records the selected harness and can record a host session, resume command, heartbeat, checkpoint, and working path.

Dispatch still does not edit code. It creates the durable contract for an external executor.

## 5. Execute outside Senderos

The host agent starts or resumes work in its own environment. That host owns:

- model and session management;
- repository and worktree operations;
- tools and external integrations;
- credentials and permission prompts;
- scheduling and process supervision.

This makes the control plane portable across harnesses and keeps side-effect authority where it belongs.

## 6. Return status and evidence

The host updates the attempt as work progresses. An attempt can store execution results, failure summaries, debug metadata, and evidence such as tests, CI checks, pull requests, artifacts, or manual validation.

Evidence is attached to the exact attempt it supports. A review decision can then approve it, request changes, or reject it with a rationale.

## 7. Advance, retry, or stop

Terminal attempt updates finalize the surrounding run and affect goal planning:

- a successful step can make the next agent transition dispatchable;
- a failed run can become eligible for a linked retry;
- a blocked goal waits for external context;
- cancellation ends the selected goal or run explicitly;
- completion means the goal lifecycle has reached its verified outcome.

The next call to `plan` derives its answer from that persisted truth—not from assumptions hidden in the previous host session.

## The design payoff

The execution environment can be replaced. The orchestration history cannot disappear with it. That is the core promise of Senderos: durable, explainable progress from intent to verified delivery.
