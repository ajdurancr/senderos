---
title: Domain Model
description: "The durable entities Senderos stores in SQLite and how they differ from external systems and host-agent sessions."
---

Senderos stores its orchestration model in SQLite.
Every operational state transition belongs to a Senderos entity.

Senderos entities are not the same thing as external-system entities.

A Senderos goal is not a GitHub issue.
A run attempt is not the host-agent's entire memory.

Senderos may reference outside systems later, but its own model stays separate.

## Core entities

- project
- goal
- run
- run attempt
- agent
- agent transition
- event

A goal is the durable requested outcome inside Senderos. A run is one logical
execution of a goal; a run attempt records a concrete execution and optional
host-session details. A working path belongs to the attempt, but is selected by
the external host rather than managed by Senderos.

Artifacts such as logs, transcripts, reports, and generated outputs live in the Senderos home directory and are referenced from the database.
The database is seeded from JSON agent records that match the agent entity shape.
