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
  "database": {
    "urlEnv": "SENDEROS_DATABASE_URL",
    "authTokenEnv": "SENDEROS_DATABASE_AUTH_TOKEN"
  },
  "artifactRoot": "/absolute/path/.senderos/artifacts",
  "logRoot": "/absolute/path/.senderos/logs",
  "cacheRoot": "/absolute/path/.senderos/cache",
  "defaultHarness": "codex",
  "output": { "format": "json" },
  "guardrails": { "restrictToHome": true }
}
```

`database.urlEnv` names the environment variable containing the libSQL URL.
`database.authTokenEnv` optionally names the variable containing the libSQL
authentication token. Senderos uses Drizzle for all runtime reads and writes.

When `senderos init` runs without a URL already set, it assigns a local `file:`
URL under the Senderos home. A remote libSQL URL works with the same runtime and
migrations; set the URL and, if required, its token in the configured variables
before running commands. The three `*Root` paths are created and checked by
`init` and `doctor`; `restrictToHome` rejects managed paths outside the
Senderos home.

## Actions

- `senderos config show`
- `senderos config get <path>`
- `senderos config set <path> <value>`

## Example

```bash
senderos config show
senderos config get database.urlEnv
senderos config set defaultHarness openclaw
```

## Notes

`config set` writes a raw string value at a dot path; it does not validate the
whole resulting object. Use `senderos doctor` immediately after changing
database or path settings. Configuration affects Senderos runtime behavior, not
host-agent state.
