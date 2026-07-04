# CHECKPOINTS — SenderOS Final State Evaluation

## C1 — Factory boundary is clean
- [ ] SenderOS repository files describe the engine, methodology, templates, or examples.
- [ ] Live project execution state is not stored directly under `apps/senderos`.
- [ ] `docs/storage-model.md` exists and matches the intended repo-vs-workspace split.

## C2 — Runtime model is complete
- [ ] Core docs reflect the runtime entities: projects, features, runs, sessions, workspaces, agents, senderos, and run-execution state.
- [ ] Built-in agents seed from markdown into SQLite runtime state.
- [ ] Default senderos are assigned during runtime init.

## C3 — Technology discipline
- [ ] Source code is TypeScript only.
- [ ] Bun is the default package manager/runtime.
- [ ] SenderOS contains no Python application logic.

## C4 — Verification is real
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Coverage threshold passes.
- [ ] Build passes.

## C5 — CLI shape is current
- [ ] `run` is the primary execution command.
- [ ] deprecated execution command aliases are not part of the public top-level workflow surface.
- [ ] `run-execution` is not part of the public top-level workflow surface.
