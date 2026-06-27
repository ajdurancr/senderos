---
title: Why Senderos Exists
description: "Why the project exists and what problem it solves for serious agent-driven delivery."
---

Software teams can now generate code quickly. That is not the hard part anymore.

The hard part is finishing a feature loop without losing control of the system.

## The actual bottleneck

Teams do not usually fail because code could not be typed fast enough.
They fail because the execution loop breaks down:

- the spec is vague,
- the acceptance criteria drift,
- implementation starts too early,
- session state disappears into chat,
- testing becomes superficial,
- mutation confidence is missing,
- parallel work collides in the same workspace,
- humans get interrupted to review half-baked output,
- nobody can answer what the system is doing right now.

Senderos exists to remove that ambiguity.

## The product thesis

Senderos treats software delivery as a factory loop.

The loop starts from clarified intent, translates that intent into a feature contract, drives implementation through test-first execution, validates through review and mutation testing, and keeps advancing until the work is actually deployable.

The user is not dragged into the middle of the loop to babysit partial outputs.
The user comes back in when the loop has produced something ready to evaluate.

## Why the CLI matters

A chat thread is not a durable operating surface.
A transient session is not a system of record.

Senderos uses a CLI because the factory needs:

- a stable entry point,
- machine-readable outputs,
- deterministic state transitions,
- repeatable operations,
- auditable history.

That is what makes the system operable by different host agents without turning the whole product into prompt soup.
