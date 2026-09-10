# Senderos Studio

Senderos Studio is the primary user interface for the Senderos platform.

It is scaffolded with React Router and intended to become the cockpit for objective planning, execution visibility, validation review, and human/AI coordination.

Studio is a detached control plane. It does not read a local `.senderos/config.json`
or require `SENDEROS_HOME`. Configure its shared libSQL database directly:

```sh
SENDEROS_DATABASE_URL=libsql://senderos.example.turso.io
SENDEROS_DATABASE_AUTH_TOKEN=...
```

Every CLI or worker instance that points to the same database participates in the
same orchestration system, regardless of its host or local filesystem.
