---
title: config
description: "Inspect and update the Senderos runtime configuration."
---

`senderos config` manages the Senderos configuration file.

The file lives at `<home>/config.json`, where `<home>` defaults to
`./.senderos` in the current directory. `senderos init` previews it before
writing it, then the runtime loads it whenever a command needs the database or
managed runtime paths.

## Runtime shape

```json
{
  "database": { "kind": "local", "path": "/absolute/path/.senderos/senderos.db" },
  "artifactRoot": "/absolute/path/.senderos/artifacts",
  "logRoot": "/absolute/path/.senderos/logs",
  "cacheRoot": "/absolute/path/.senderos/cache",
  "defaultHarness": "codex",
  "output": { "format": "json" },
  "guardrails": { "restrictToHome": true }
}
```

`database` selects the adapter used by runtime commands. The local SQLite
adapter is fully operational. Turso can be described and health-checked, but
its command-execution connection is not implemented yet. The three `*Root`
paths are created and checked by `init` and `doctor`; `restrictToHome` rejects
managed paths outside the Senderos home.

## Actions

- `senderos config show`
- `senderos config get <path>`
- `senderos config set <path> <value>`

## Example

```bash
senderos config show
senderos config get database.kind
senderos config set defaultHarness openclaw
```

## Notes

`config set` writes a raw string value at a dot path; it does not validate the
whole resulting object. Use `senderos doctor` immediately after changing
database or path settings. Configuration affects Senderos runtime behavior, not
host-agent state.
