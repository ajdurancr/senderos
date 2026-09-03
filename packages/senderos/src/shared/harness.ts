import type { HarnessKind } from "../shared/types";
export function inferHarnessFromEnvironment(env: NodeJS.ProcessEnv = process.env): HarnessKind {
  if (env.OPENCLAW_WORKSPACE_DIR || env.OPENCLAW_STATE_DIR || env.OPENCLAW_SESSION_KEY) return "openclaw";
  if (env.CODEX_SANDBOX || env.CODEX_HOME || env.CODEX_SESSION_ID) return "codex";
  if (env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT || env.CLAUDECODE_SESSION) return "claude-code";
  return "unknown";
}
