---
title: doctor
description: "Validate the Senderos runtime, database connectivity, guardrails, and harness readiness."
---

`senderos doctor` verifies that Senderos can operate safely.

## What it checks

- configuration validity,
- configured libSQL connection health,
- directory integrity,
- managed home-directory accessibility,
- the configured harness label (not real host or model readiness),
- availability of every required runtime table and column, including retained attempt history.

## Examples

```bash
senderos doctor
senderos help doctor
```

## Typical use cases

Use `doctor` when:

- finishing installation,
- changing configuration,
- debugging a broken runtime,
- validating a host before scheduling dispatch cycles.

## Damaged local runtimes

`doctor` can run without an execution context. A missing, unreadable, malformed or
incomplete configuration returns the normal `{ ok: false, issues, warnings }`
report instead of preventing diagnostics from running. Invalid field names are
reported without echoing configuration contents. Managed paths must be absolute
directories; an existing file is not a healthy directory.

Inspection does not rewrite the configuration, create missing managed directories
or repair data. Restore configuration from a trusted copy or correct the named
fields, then run `doctor` again before operational commands. As with other health
reports, inspect `ok` and `issues`; an unhealthy report is valid JSON output, not a
successful runtime validation. A configured harness label does not certify a real
host, external session or model provider.

## Database schema availability

The database probe reads schema metadata and compares table and column names with
Senderos's current runtime model. Missing tables and columns produce issues such
as `missing table:run_attempts` or `missing column:run_attempts.result_json`.
A view cannot replace a required writable table. Extra tables and columns are
allowed, and inspection does not read retained row payloads, migrate, reset or
repair the database.

This is an availability check, not a complete integrity audit. It does not verify
column types, constraints, indexes, stored data consistency or external host
readiness. Preserve the database and follow the documented upgrade/recovery path
before operational work; do not delete history to clear a diagnostic.

For a local file database, the probe checks that the configured file exists before
opening a new connection. An absent file reports `missing database:<path>`; a
directory reports `not a database file:<path>`. Diagnosing either condition does
not create a replacement database. Existing reset locks remain authoritative.
Initialization and operational connections retain their explicit creation behavior;
this prerequisite applies to diagnostics, not to remote or in-memory connections.

## Safe connection diagnostics

The reported database URL is for inspection only. URL credentials, user information,
unknown query options and fragments are redacted. Recognized nonsecret `tls` and
`cache` settings remain visible when valid. The configured URL and credentials
used by the connection are unchanged.

Driver exception text is omitted because it may include credentials or remote
response contents. Diagnostics provide safe guidance for invalid URLs, unreadable
files, lock contention and file access failures; other connection failures guide
you to check the URL, credentials, access and connectivity. Missing environment
variables, local files, reset locks and required schema names retain specific
actionable findings. An unhealthy report never certifies connectivity.
