---
title: init
description: "Create the Senderos runtime directory, configuration, and initial database state."
---

`senderos init` bootstraps a working Senderos runtime.

## What it does

- creates the Senderos home directory,
- writes the configuration file,
- creates artifact directories,
- creates the local SQLite database or stores remote DB configuration,
- initializes the schema.

## Examples

```bash
senderos init
senderos init --json
```

## Typical use cases

Use `init` when:

- setting up a new local environment,
- switching to a new Senderos home directory,
- preparing a clean runtime for a new repository.
