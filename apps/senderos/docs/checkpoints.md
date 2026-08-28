# CHECKPOINTS — Agent transitions Final State Evaluation

## C1 — Factory boundary is clean
- [ ] Senderos repository files describe the engine, methodology, templates, or examples.
- [ ] Live project execution state is not stored directly under `apps/agent transitions`.
- [ ] `docs/storage-model.md` exists and matches the intended repo-vs-checkout split.

## C2 — Runtime model is complete
- [ ] Core docs reflect the runtime entities: projects, goals, runs, run attempts, checkouts, agents, agent transitions, and run-execution state.
- [ ] Built-in agents seed from JSON records into SQLite runtime state.
- [ ] Default agent transitions are assigned during runtime init.

## C3 — Technology discipline
- [ ] Source code is TypeScript only.
- [ ] Bun is the default package manager/runtime.
- [ ] Agent transitions contains no Python application logic.

## C4 — Verification is real
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Coverage threshold passes.
- [ ] Build passes.

## C5 — CLI shape is current
- [ ] `plan` is the global planning command.
- [ ] `run dispatch` is the forward-dispatch mutation command.
- [ ] deprecated execution command aliases are not part of the public top-level workflow surface.
- [ ] help output contains agent-focused descriptions by default and supports `--omit-agent-description`.
