---
title: bootstrap-agent-skill
description: "Install portable, configuration-agnostic guidance for discovering and operating Senderos through its CLI."
---

`senderos bootstrap-agent-skill` prints or installs a small, portable skill that explains what Senderos is and directs people or agents to discover current workflows and actions through CLI help.

The skill contains no harness, home path, runtime configuration, project layout, or command sequence. It does not initialize or configure Senderos.

## Preview the generated skill

```bash
senderos bootstrap-agent-skill --print
```

Use `--print` to inspect or copy the content without writing a file.

## Write the scaffold

```bash
senderos bootstrap-agent-skill \
  --path ./skills/senderos/SKILL.md
```

The default output path is `./skills/senderos/SKILL.md`. Existing files are protected unless `--force` is supplied.

## Options

| Option | Meaning |
| --- | --- |
| `--print` | Return content without writing it |
| `--path` | Select the skill file path |
| `--force` | Overwrite an existing skill file |

## Adapter boundary

The skill is intentionally thin. The CLI's command help remains the current source of truth, while the human or agent chooses how to apply the available workflows to the task at hand.
