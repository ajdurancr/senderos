---
title: db
description: Confirm and rebuild a local Senderos database without replacing its configuration.
---

`senderos db reset` is interactive local maintenance. It is not an active-run
recovery command and does not stop Studio, workers or schedulers for you.

## Before resetting

1. Stop **every writer** using the database, including other contexts' Studio
   instances, hosts and external schedulers. Preserve any work you need.
2. Use the current CLI and the correct existing runtime home. Its default is
   `./.senderos` in the current working directory, not `~/.senderos`.
3. Set the environment variable named by `config.json`'s `database.urlEnv` to the
   actual local file URL. No unset-variable fallback is used for reset. Studio
   uses its own `SENDEROS_DATABASE_URL`; verify both address the intended file.

```bash
senderos config get database.urlEnv --home /absolute/path/.senderos
senderos db reset --home /absolute/path/.senderos
```

The command displays the configuration file, exact database path, configured
context ID and cross-context consequences. It requires a terminal on stdin and
stderr and the exact phrase `RESET /absolute/path/to/database.db`. Any other
answer, Enter or EOF declines without changing the database or configuration.
Piped input and the unsupported `--yes`/`--force` flags cannot authorize a reset.
Preview uses filesystem reads only: it does not open SQLite, create journals,
migrate or seed the target before confirmation.

## What changes

Every context's projects, goals, runs, attempts, evidence/events, custom agents,
custom Senderos and publications, host registrations and workspace grants are
removed from the active database. This includes other runtimes sharing the file.
The fresh database contains the current migrations and built-in agent/Sendero
seeds. Only the selected configuration's execution context is restored, using
its existing ID and registered name.

`config.json` is preserved byte-for-byte. `.env`, repositories and configured
artifact, log and cache directories are not cleared. Retained artifacts may
therefore refer to old records. Reset does not call `init`, rewrite configuration,
dispatch work or execute a model.

Afterward run `senderos doctor --home ...` and `senderos status --home ...` with
the same configured URL. Register any additional contexts and hosts again and
recreate their project grants and workspace declarations before resuming work.

## Safety and recovery

Only an existing, recognized local Senderos SQLite database is supported. Remote
`libsql://`/HTTP URLs, in-memory databases, ambiguous/relative URLs, unsafe file
types, symlink/hard-link traps and protected non-database paths are refused.
Current databases and recognized older migration prefixes from
`0002_execution_contexts` onward are supported. The bundled migration history
and matching schema must agree; unknown history, missing ownership structures or
pre-context schemas are refused rather than guessed. Recognition does not apply
migrations to the original database.
Schema/activity checks happen after confirmation but before replacement. Active
work or unresolved worker ownership in **any context** blocks reset. Finish or
reconcile work through the normal lifecycle instead of bypassing the refusal.

The command checks the approved target again, coordinates resets with a lock,
and requires SQLite's exclusive fence. A fresh replacement is built and validated
before switching the active file. WAL/journal state must be safely settled;
sidecars are not blindly deleted. Cooperating current CLI/Studio connections
refuse to open the target during reset. Older clients, external tools and already
open connections are not universal process-detection or fencing guarantees:
stopping all writers remains mandatory.

A private recovery backup is retained and its `backupPath` is printed. It
contains the old database, including history and worker claim records; protect it
like the original and do not attach it to public issues. This is a recoverable
reset, not secure erasure. The original remains available when preparation fails.
If an interrupted operation reports recovery paths or leaves a reset lock, keep
writers stopped and inspect those exact files. Never delete a lock merely because
it looks old or wildcard-delete a directory. Restore a backup only while all
writers are stopped, after preserving the current database and its sidecars.
Remove backups or recovery artifacts only after verifying the intended database
and deciding their data is no longer needed.

Deleting a local cache does not reset a remote libSQL database. Remote reset is
outside this command's scope.
