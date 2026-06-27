---
title: Why Senderos Exists
description: "Why the project was built and which failure modes it is designed to eliminate."
---

## The short version

Senderos exists because agent-driven software work gets flaky fast when the only control surface is a conversation.

That setup feels good at first, then falls apart when you need real operational discipline.

## The failure modes it targets

### Prompt soup

Without a control plane, every new action becomes another prompt asking an agent to remember context, infer the right next step, and avoid repeating work. That is brittle.

### Session dependency

When status lives inside one active shell or one cloud session, the user loses visibility the moment that session hangs, exits, or gets abandoned.

### No durable audit trail

Users need to answer boring but essential questions:

- What was started?
- What is blocked?
- What failed?
- What already got pushed?
- Was the temp workspace cleaned up?
- Which agent session should be resumed?

If the system cannot answer those quickly, it is not operationally serious.

### Unsafe automation

Autonomy without state and policy is how you get duplicate runs, surprise branches, accidental pushes, and a nice little pile of chaos.

Senderos is meant to enable automation **with boundaries**, not automation by vibes.

## Why local-first matters

The actual coding work should run inside the user’s environment whenever possible.

That gives the user:

- direct ownership of repos and credentials,
- simpler debugging,
- fewer hidden external dependencies,
- better portability across agents,
- easier recovery when a run fails mid-stream.

External systems still matter, but they should be integrations, not the soul of the product.

## Why a CLI instead of a giant skill

Skills are useful. They are also a terrible place to bury core platform logic.

A CLI gives Senderos:

- explicit commands,
- machine-readable discovery,
- repeatable automation,
- shell and script compatibility,
- easier testing,
- a stable interface across agent ecosystems.

That is the real reason Senderos makes sense as a system rather than “just more prompt instructions.”
