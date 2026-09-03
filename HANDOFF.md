# Handoff: Senderos all-entity one-file-per-action restructure

## Objective

Finish the Senderos source-layout refactor so each entity/action implementation lives in its own file, imports and exports remain stable where intended, tests follow moved code, and package scripts reference the new locations.

Target layout:

- `commands/<entity>/<action>.ts` for entity actions.
- Generic actions should follow the same convention where appropriate, including config, planning, health/system, and status/system.
- Bootstrap/system seeding belongs outside `commands/agents`.
- Mission Control actions remain one file each.
- Test helpers and scripts live under `src/`.

The full original request text was not available in the visible session transcript. The observable requested scope is the "all-entity, one-file-per-action" restructure, including attempts, goals, projects, runs, transitions, config, system, planning, and other discovered entities.

## Requirements Status

- **PARTIAL — agents:** `src/commands/agents/list.ts`, `get.ts`, and `get-by-slug.ts` now exist. `src/commands/index.ts` exports them and agent tests import them directly.
- **PARTIAL — bootstrap:** `src/commands/agents/index.ts` was moved to `src/bootstrap/seed-agents.ts`, and JSON agent seeds moved to `src/bootstrap/agents/`. The bootstrap module still duplicates `listAgents`, `getAgent`, and `getAgentBySlug`; those should be removed. `builtInAgentSeedDir()` still resolves `db-seeds/agents`, which conflicts with the move and must be reconciled.
- **NOT STARTED — attempts:** `src/commands/attempts/index.ts` still contains `createRunAttempt`, `getRunAttempt`, `listRunAttempts`, and `updateRunAttempt`.
- **NOT STARTED — goals:** `src/commands/goals/index.ts` still contains `createGoal`, `listGoals`, `getGoal`, `updateGoal`, `activateGoal`, and `cancelGoal`.
- **NOT STARTED — projects:** `src/commands/projects/index.ts` still contains `defaultProjectIdForPath`, `defaultProjectNameForPath`, `createProject`, `getProject`, `listProjects`, and `updateProject`.
- **NOT STARTED — runs:** `src/commands/runs/index.ts` still contains `createRunRecord`, `getRun`, and `latestRunForGoal`; `src/commands/runs/execution.ts` still contains several actions.
- **NOT STARTED — transitions:** `src/commands/transitions/index.ts` still contains `createAgentTransition`, `listAgentTransitions`, `getAgentTransition`, and `listAgentTransitionsForAgent`.
- **NOT STARTED — generic commands:** `src/commands/config.ts` has get/update; planning, health, and status remain standalone command files.
- **PARTIAL — Mission Control:** action files already exist (`goal.ts`, `overview.ts`, `start-goal.ts`, `stop-execution.ts`, `retry-execution.ts`) but imports must be updated as command actions move.
- **PARTIAL — scripts/test support:** scripts and `tests/helpers/runtime.ts` were moved under `src/`; the structure checker is broken after its move.
- **UNCLEAR — Claude adapter documentation:** `packages/senderos/adapters/claude/CLAUDE.md` and `README.md` were deleted in commit `9954afe`. No visible request explains whether deletion is intentional; do not restore or finalize the decision without recovering the original scope.

## Current Repository State

- Repository: `/data/tmp/Senderos`
- Branch: `feat/studio-mission-control-api`
- Current ref: `9954afe refactor: split agent actions into modules`
- Remote PR: https://github.com/ajdurancr/senderos/pull/11
- Working tree was clean immediately before adding this handoff file.

The previous partial restructure is committed in `9954afe`; this document is intended to preserve its precise state for the next implementation agent.

## Pending Implementation Plan

1. Establish the final module convention. Keep `index.ts` files as export-only barrels if they remain; no action implementation should remain in a bundled index file.
2. Complete the agent/bootstrap split. Retain seed-only behavior in `src/bootstrap/seed-agents.ts`; remove duplicated query actions; make `builtInAgentSeedDir()` point to the final seed JSON location; adjust imports and tests.
3. Split attempts, goals, projects, runs, transitions, config, planning, health/system, and status/system into action files. Update every command barrel, public export, internal import, and test.
4. Fix `src/scripts/check-test-structure.ts`: it currently resolves its source root to `src/src`, causing an `ENOENT` failure. Audit the relocated test helper imports too.
5. Search for stale paths and barrel imports, including `db-seeds/agents`, old script paths, and old `tests/helpers` paths. Resolve the Claude adapter doc deletions only when their intended scope is known.

## Architecture and Conventions

- TypeScript ESM with Bun tests; package root is `packages/senderos`.
- Unit tests are colocated as `*.test.ts`.
- `src/commands/index.ts` is the command aggregation surface; `src/index.ts` is the package API surface.
- Database operations use `db/client.ts`; row mapping uses `db/mappers.ts`; domain types live in `shared/types.ts`.
- Use named exports and direct action imports internally.
- The coverage tooling enforces sibling or directory tests for implementation files with exported functions.

## Validation

Commands already run against the state committed in `9954afe`:

```text
bun run --cwd packages/senderos typecheck
PASS — tsc -p tsconfig.json --noEmit

bun run --cwd packages/senderos test:unit
PASS — 44 tests, 0 failures

bun run --cwd packages/senderos src/scripts/check-test-structure.ts
FAIL — ENOENT: scandir '/data/tmp/Senderos/packages/senderos/src/src'
```

Run after implementation:

```bash
cd /data/tmp/Senderos
bun run --cwd packages/senderos typecheck
bun run --cwd packages/senderos test:unit
bun run --cwd packages/senderos coverage
bun run test
bun run typecheck
```

## Risks and Assumptions

- Preserve the existing commits and working tree; do not reset, clean, or discard related work.
- Moving every function in `shared/` and `db/` may be outside the requested scope. Treat them as supporting modules unless the recovered request explicitly includes them.
- Typechecking and unit tests passing do not validate the moved structure checker; its failure is real and must be fixed.
- Do not invent API changes or documentation intent that is not supported by the recovered original request.

## Copy-Paste Prompt for the New Agent

```text
Continue the Senderos all-entity, one-file-per-action restructure in /data/tmp/Senderos on branch feat/studio-mission-control-api.

Start from the existing committed state and preserve all relevant work. Do not reset, clean, checkout, or discard changes.

Complete the action-file split for attempts, goals, projects, runs, transitions, config, planning, health/system, status/system, and any other command entities found. Index files may remain only as export-only barrels. Agent list/get/get-by-slug are already split, but bootstrap seeding remains partial: keep seed-only code in src/bootstrap/seed-agents.ts, remove duplicated agent query actions, and reconcile its seed directory with src/bootstrap/agents.

Update all imports, exports, tests, integration tests, script paths, and relevant docs/adapter references. Keep Mission Control action files and update their command imports. Fix src/scripts/check-test-structure.ts, which currently scans src/src and fails with ENOENT.

Investigate the deleted Claude adapter docs and src/scripts/inspect-db.ts before finalizing them; their intent is not established in the available context. Do not invent API changes.

Validate with:
- bun run --cwd packages/senderos typecheck
- bun run --cwd packages/senderos test:unit
- bun run --cwd packages/senderos coverage
- bun run test
- bun run typecheck

Report changed files and actual validation results only after the work is complete.
```
