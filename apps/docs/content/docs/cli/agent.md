---
title: agent
description: "Create, import, update, and inspect custom agent definitions."
---

Agent definitions contain instructions, a name, and optional descriptive metadata.
They do not launch a model or require any particular harness.

```bash
senderos agent create --slug researcher --name Researcher \
  --instructions "Gather sources and report the configured outcome."
senderos agent create --slug editor --name Editor --instructions-file ./editor.txt
senderos agent update researcher --instructions "Use primary sources and explain uncertainty."
senderos agent import --file ./agent.json
senderos agent list
senderos agent show researcher
```

Import JSON uses `slug`, `name`, and `instructions` (or `definitionBody`), with
optional `description`, `status`, and `defaultGoal`. Updates accept an ID or slug
and preserve fields you do not change. Inspect command help for all options.

Published sendero versions snapshot their agent instructions. Editing a global
agent definition changes future publications; it does not mutate packets for goals
pinned to an existing published version. Bundled agents are editable examples,
not a required software-development workflow. Ordinary runtime initialization
preserves edits and renamed built-in agents. On upgrade, old publications snapshot
then-current instructions; original historical instructions cannot be reconstructed
if the earlier version never stored them.
