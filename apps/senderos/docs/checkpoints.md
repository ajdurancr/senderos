# CHECKPOINTS — SenderOS Final State Evaluation

## C1 — Factory boundary is clean
- [ ] SenderOS repository files describe the engine, methodology, templates, or examples.
- [ ] Live project execution state is not stored directly under `apps/senderos`.
- [ ] `docs/storage-model.md` exists and matches the intended repo-vs-workspace split.

## C2 — Harness completeness
- [ ] `AGENTS.md`, `init.sh`, and core docs exist inside `apps/senderos`.
- [ ] Template and example directories exist.
- [ ] `bun run init` exits successfully.

## C3 — Technology discipline
- [ ] Source code is TypeScript only.
- [ ] Bun is the default package manager/runtime.
- [ ] SenderOS contains no Python application logic.

## C4 — Verification is real
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Build passes.
