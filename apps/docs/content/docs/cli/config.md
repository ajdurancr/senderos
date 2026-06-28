---
title: config
description: "Inspect and update the Senderos runtime configuration."
---

`senderos config` manages the Senderos configuration file.

## Actions

- `senderos config show`
- `senderos config get <path>`
- `senderos config set <path> <value>`

## Example

```bash
senderos config show
senderos config get database.kind
senderos config set harness.default openclaw
```

## Notes

Configuration changes affect Senderos behavior, not host-agent state.
When a host action is required after a config change, Senderos reports that requirement explicitly.
