---
name: senderos
description: Use Senderos through its CLI to coordinate work, discover supported workflows and actions, and inspect their current guidance before deciding what to do.
---

# Senderos

Senderos is an orchestration system for turning intent into structured, observable work. Its CLI is the interface for people and agents to discover workflows, perform actions, and inspect current state.

At the beginning of each session, before any other Senderos operation, run `bunx --bun senderos@latest --help`. This forces Bun to fetch and run the latest published CLI while also exposing its current top-level guidance. Do this only once per session. Reuse that resolved CLI version for every later Senderos operation in the same session; do not refresh it again during the session.

Use the CLI help as the source of truth. Start with the top-level help to discover workflows, then inspect the help for the relevant command before acting. Prefer the command's current descriptions, options, and guidance over assumptions or remembered syntax.

Choose the workflow and action that fit the user's intent and the current state. Ask for human input when a decision requires judgment or approval. After acting, report the meaningful result and any remaining decision or next step.

Do not assume a particular agent harness, filesystem location, runtime configuration, project structure, or execution environment.
