# Senderos Studio

Senderos Studio is the primary user interface for the Senderos platform.

Built with React Router, it provides goal planning, directed Sendero authoring, custom agents, parallel activation monitoring, and evidence review.

Studio is a detached control plane. It does not read a local `.senderos/config.json`
or require `SENDEROS_HOME`. Configure its shared libSQL database directly:

```sh
SENDEROS_DATABASE_URL=libsql://senderos.example.turso.io
SENDEROS_DATABASE_AUTH_TOKEN=...
```

Every CLI or worker instance that points to the same database participates in the
same orchestration system, regardless of its host or local filesystem.

On startup, Studio applies the bundled database migrations and idempotently seeds
the built-in agents. The database identity remains the only shared deployment
dependency.

## Production verification

From the repository root, with dependencies installed and Node 24 available:

```sh
bun run --cwd apps/studio build
bun run --cwd apps/studio smoke:production
SENDEROS_DATABASE_URL=file:/absolute/path/senderos.db bun run --cwd apps/studio start
```

The build packages migrations and built-in agent/Sendero definitions under
`build/server/`. The production server also needs the installed Studio runtime
dependencies: libSQL and Drizzle stay external so native database loading uses
normal Node package resolution. Do not deploy `build/` alone without those dependencies.

The production smoke starts the actual Node server on an ephemeral local port,
uses a fresh temporary database, checks all main SSR screens and emitted assets,
and creates an agent and Sendero through HTTP. It removes its test database on
exit and explicitly unsets `NODE_PATH` and any database authentication token.
