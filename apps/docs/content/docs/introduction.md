---
title: Introduction
description: "What Senderos is and how the current runtime model works."
---

Senderos is an orchestration system for planning and dispatching software work across persisted runtime state and external execution agents.

The CLI is the public interface. Under it lives deterministic services, persisted goals and execution state, planning, and dispatch.

Senderos stores state, decides what is dispatchable next, and records what happened.
The host agent performs the actual external work.
