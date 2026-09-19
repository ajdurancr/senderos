# Senderos CLI

The `senderos` command-line interface is the local control surface for the
Senderos engineering orchestration platform.

## Requirements

- Bun 1.3 or newer

## Install

```bash
bun add --global senderos
```

You can also run the CLI without a global installation:

```bash
bunx senderos --help
```

## Initialize an execution context

Preview the configuration first:

```bash
senderos init --name "My project"
```

Then approve the initialization:

```bash
senderos init --name "My project" --approve
```

Run `senderos --help` for the complete command reference. Product and operator
documentation lives in the [Senderos repository](https://github.com/ajdurancr/senderos).
