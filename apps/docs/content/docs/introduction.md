---
title: Introduction
description: "What Senderos is, what problem it solves, and the core mental model behind the project."
---

## What Senderos is

Senderos is a **local-first orchestration system for agent-driven software delivery**.

In plain English: it gives a user and their coding agents a durable control plane for work that would otherwise disappear into chat threads, temporary shells, or half-finished sessions.

Senderos is meant to coordinate the full path from:

1. a feature idea,
2. to a clarified spec,
3. to acceptance criteria,
4. to implementation kickoff,
5. to tracked coding runs,
6. to final completion and cleanup.

## What problem it solves

Most agent workflows break down in the same places:

- the plan lives in chat, not in durable state,
- status depends on one specific session still being alive,
- there is no clean distinction between a feature, a task, a run, and an agent session,
- automation becomes risky because there is no real policy layer,
- users cannot reliably resume, inspect, or audit what happened.

Senderos fixes that by making the **CLI and persisted state** the source of truth.

## Core mental model

Senderos is not “the smart prompt.” It is not “a giant skill.” It is not “just a bot command.”

It is a system with three strong opinions:

### 1. The CLI is the control plane

Everything important should be inspectable and operable through a command surface such as:

```bash
senderos feature create
senderos feature kickoff feature-123
senderos run status run-456
senderos worker tick
```

### 2. State must outlive the agent session

Feature state, task status, run attempts, workspace cleanup, and session handles should survive:

- agent restarts,
- shell crashes,
- process exits,
- context window loss,
- switching from one agent to another.

### 3. Skills and harnesses are adapters

An OpenClaw skill, a Codex session, or a Claude Code harness should **operate** Senderos, not become Senderos.

That keeps the workflow portable and prevents prompt logic from becoming the architecture.

## What Senderos is responsible for

Senderos owns orchestration concerns such as:

- specs and feature state,
- queued work and dependency tracking,
- coding run metadata,
- external session references,
- reconciliation and status reporting,
- scheduling and worker execution,
- safety policy and confirmation boundaries.

## What Senderos does not try to own

Senderos should not pretend to replace the coding agent itself.

It does **not** need to be the LLM, the code editor, the git remote, or the full backlog tool. It coordinates those things through adapters and stores the state that makes the whole workflow understandable.
