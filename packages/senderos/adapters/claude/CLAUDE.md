When Claude is used as an execution backend for Senderos, it should consume the canonical built-in agent definitions from `apps/senderos/db-seeds/agents/*.json`. Human-readable examples live in `apps/docs/content/docs/reference/system-agents/`.

Claude-specific artifacts must not redefine Senderos architecture or make Claude the source of truth for the agent model.
