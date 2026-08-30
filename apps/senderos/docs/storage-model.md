# Storage Model

SQLite is the authority for structured Senderos state: projects, goals, agents, transitions, runs, attempts, PR linkage, and events.

Large artifacts stay on disk under the Senderos home directory:

```text
~/.senderos/
  config.json
  senderos.db
  artifacts/
  logs/
  cache/
```

`run_attempts.working_path` records the physical checkout used by an attempt. There is deliberately no workspace entity or lifecycle table.
