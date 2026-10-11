---
title: bootstrap-agent-skill
description: "Install portable, configuration-agnostic guidance for discovering and operating Senderos through its CLI."
---

`senderos bootstrap-agent-skill` prints or installs a small, portable skill that explains what Senderos is and directs people or agents to discover current workflows and actions through CLI help.

The skill explains the portable host protocol without assuming a specific harness,
home path, account, or execution environment. It does not initialize or configure
Senderos or install a scheduler.

## Preview the generated skill

```bash
senderos bootstrap-agent-skill --print
```

Use `--print` to inspect or copy the content without writing a file.

## Write the scaffold

```bash
senderos bootstrap-agent-skill \
  --path ./.agents/skills/senderos/SKILL.md
```

The default output path is `./.agents/skills/senderos/SKILL.md`, following the shared agent-skill convention. Existing files are protected unless `--force` is supplied.

The installed skill directs its user to inspect the selected CLI build once per
session and reuse it. For published packages, use `bunx --bun senderos@latest --help`
once. For a source checkout or unreleased change, use that checked-out CLI instead
of silently switching to a different published version.

## Options

| Option | Meaning |
| --- | --- |
| `--print` | Return content without writing it |
| `--path` | Select the skill file path |
| `--force` | Overwrite an existing skill file |

## Adapter boundary

The skill is intentionally thin. The CLI's command help remains the current source of truth, while the human or agent chooses how to apply the available workflows to the task at hand.
