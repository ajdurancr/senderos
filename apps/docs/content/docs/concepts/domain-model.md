---
title: Domain Model
description: "The durable entities Senderos stores in SQLite and how they differ from external systems and host-agent sessions."
---

Senderos stores its orchestration model in SQLite.
Every operational state transition belongs to a Senderos entity.

Senderos entities are not the same thing as external-system entities.

A Senderos feature is not a GitHub issue.
A Senderos task is not a Jira ticket.
A Senderos session is not the host-agent's entire memory.

Senderos may reference outside systems later, but its own model stays separate.

## Core entities

- project
- feature
- run
- run execution
- session
- workspace
- sendero
- agent
- task
- event

A feature is the durable work item inside Senderos.
A task is a Senderos-owned operational unit under a feature.
A session is Senderos' record of a host-agent execution handle.
A workspace is a Senderos-managed execution directory.

Artifacts such as logs, transcripts, reports, and generated outputs live in the Senderos home directory and are referenced from the database.
Human-readable agent role files can live alongside the app, while the database is seeded from JSON agent records that match the agent entity shape.
