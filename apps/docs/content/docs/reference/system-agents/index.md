---
title: System agents
description: Predefined Senderos system-agent examples and the shared structure they follow.
---

Senderos ships built-in system agents as runtime seed records under `apps/senderos/db-seeds/agents/*.json`.

The pages in this section are human-readable examples of those built-in agents. They are documentation artifacts, not runtime inputs.

## Shared structure

Each built-in agent definition follows the same high-level shape:

- **Name** — the runtime-facing agent name
- **Summary** — the role in one sentence
- **Operating protocol** — how the agent should approach the work
- **Expected output** — the response shape the runtime expects
- **Hard rules** — boundaries that should not be violated
- **Preconditions** — when the agent is appropriate

If the runtime seed changes, the documentation example should stay aligned with it.
