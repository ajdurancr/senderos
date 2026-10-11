# Senderos CLI

The `senderos` command-line interface is the local control surface for the
Senderos persistent orchestration platform for user-defined agents and workflows.

## Requirements

- Bun 1.3 or newer

Contributors running tests or release checks need **Bun 1.3.14 or newer on
Linux or macOS**, plus Node.js/npm for the installed tarball check. CI uses the
repository's pinned Bun 1.3.14 toolchain and Node.js 24. Terminal safety tests
probe PTY allocation and capture and fail with diagnostics if unavailable;
they are never skipped. This test prerequisite does not change the CLI engine range.

From the repository root, verify the full `prepublishOnly` / `release:check`
chain with both kinds of parent terminal:

```bash
env -u SENDEROS_DATABASE_URL -u SENDEROS_DATABASE_AUTH_TOKEN bun scripts/check-release-terminal.ts pipe
env -u SENDEROS_DATABASE_URL -u SENDEROS_DATABASE_AUTH_TOKEN bun scripts/check-release-terminal.ts terminal
```

Both commands include workspace coverage and an installed npm tarball smoke
test using disposable local databases. The terminal run validates real stdin,
stdout and stderr TTY descriptors before starting the release chain.

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

## Reset a local database

Stop Studio, every host worker and scheduler using the database first. From an
interactive terminal, with the configured database URL environment variable set:

```bash
senderos db reset --home /absolute/path/.senderos
```

This reads the existing `config.json`, displays the exact local database path,
and requires typing `RESET /absolute/path/to/database.db`. Enter, a different
answer, EOF or piped input cannot approve it. There is no `--yes` or `--force`.

Reset replaces **all execution contexts'** orchestration records in that file,
including custom definitions, projects, goals, attempts, history, hosts and
workspace grants. It rebuilds migrations and built-in agents/Senderos, then
restores this configuration's context ID and existing name. Re-register other
contexts and hosts/grants/workspaces before using them again. Configuration
bytes, `.env`, repositories, artifacts and logs remain untouched.

A private recovery backup of the old database is retained at the `backupPath`
printed on success. It contains the old records, so reset is not secure erasure.
Keep it until the new database is verified; its deletion is a separate operator
decision. Remote libSQL, in-memory, ambiguous paths, active work and concurrent
resets are refused. The lock does not prove that every older or external process
has stopped. See the repository's `cli/db` operator guide for recovery details.
