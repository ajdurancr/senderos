---
title: bootstrap-agent-skill
description: "Generate a portable skill scaffold that teaches a host agent how to operate Senderos without moving orchestration logic into the adapter."
---

`senderos bootstrap-agent-skill` creates the operating layer for an agent-driven setup. The generated Markdown skill teaches a host agent to initialize Senderos, register projects, turn discussions into goals, and use the CLI as the source of truth.

It does not initialize the Senderos runtime or launch an agent.

## Preview the generated skill

```bash
senderos bootstrap-agent-skill --print
```

Use `--print` to inspect or copy the content without writing a file.

## Write the scaffold

```bash
senderos bootstrap-agent-skill \
  --path ./skills/senderos-operator/SKILL.md \
  --home /absolute/path/.senderos \
  --harness codex
```

The default output path is `./skills/senderos-operator/SKILL.md`. Existing files are protected unless `--force` is supplied.

## Options

| Option | Meaning |
| --- | --- |
| `--print` | Return content without writing it |
| `--path` | Select the skill file path |
| `--force` | Overwrite an existing skill file |
| `--home` | Include a preferred Senderos home in generated next steps |
| `--harness` | Include a preferred host harness in generated next steps |

## Adapter boundary

The scaffold is intentionally thin. It teaches correct command usage and human interaction, while planning and lifecycle rules stay inside Senderos. If an adapter starts independently deciding what is dispatchable, the system has acquired two competing control planes.
