# Senderos

Senderos is a stateful orchestration engine for software-change goals. It plans work across agents, records concrete execution attempts, and keeps the result auditable.

## Runtime model

`Project → Goal → Run → Run Attempt`

- A **goal** is a requested outcome: feature, bugfix, refactor, maintenance, security work, or migration.
- An **agent transition** is an allowed handoff from one agent to another.
- A **run** is a logical execution of one goal.
- A **run attempt** is a concrete execution, including its host-session details and physical `working_path`.

The runtime stores structured state in SQLite and large artifacts on disk under `.senderos/`.

## CLI

```bash
senderos init --approve
senderos project create --canonical-path /repo --github-owner owner --github-repo repo
senderos goal create --project-id <project-id> --title "Fix login" --kind bugfix --spec-text "Users can sign in"
senderos goal activate <goal-id>
senderos plan
senderos run dispatch --goal-id <goal-id> --transition-id <transition-id> --agent-id <agent-id> --working-path /repo
```

See `docs/state-model.md`, `docs/storage-model.md`, and `docs/workflow.md`.
