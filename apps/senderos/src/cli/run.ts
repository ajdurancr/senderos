import { resolve } from "node:path";
import { configPathForHome, defaultHomePath, initializeRuntime, loadConfig, previewInit } from "../config/runtime";
import { cancelFeature, approveFeature, createFeature, getFeature, listFeatures, updateFeature } from "../services/runtime/features";
import { cancelRun, doctor, getConfigPath, listRuns, listSessions, previewInit as _ignore, reconcile, resumeSession, schedulePlan, showLoop, startLoop, status, tickLoop, updateConfigPath } from "../services/runtime/operations";
import { getRun, getSession } from "../services/loop";
import type { HarnessKind } from "../domain/types";
import { parseArgs } from "./args";
export async function runCli(argv = process.argv.slice(2)) {
  const { positionals, options } = parseArgs(argv);
  const cmd = positionals[0]; const sub = positionals[1];
  const home = resolve(String(options.home ?? defaultHomePath()));
  try {
    let result: unknown;
    switch (cmd) {
      case "init": {
        const preview = previewInit(options.home as string | undefined, options.harness as HarnessKind | undefined);
        if (!options.approve) result = preview;
        else if (!options.harness && preview.inferredHarness === "unknown") throw new Error("Harness is not known. Re-run with --harness <openclaw|codex|claude-code> and --approve.");
        else result = initializeRuntime(preview.home, preview.config);
        break;
      }
      case "doctor": result = doctor(home); break;
      case "config":
        if (sub === "show") result = loadConfig(home);
        else if (sub === "get") result = { path: positionals[2], value: getConfigPath(positionals[2], home) };
        else if (sub === "set") result = updateConfigPath(positionals[2], positionals[3], home);
        else throw new Error("Unknown config action");
        break;
      case "feature":
        if (sub === "create") result = createFeature({ home, title: String(options.title ?? ""), problemStatement: String(options['problem-statement'] ?? ""), contractText: String(options.contract ?? ""), completionCriteria: String(options['completion-criteria'] ?? "") });
        else if (sub === "list") result = listFeatures(home);
        else if (sub === "show") result = getFeature(positionals[2], home);
        else if (sub === "update") result = updateFeature({ home, id: positionals[2], title: options.title as string | undefined, problemStatement: options['problem-statement'] as string | undefined, contractText: options.contract as string | undefined, completionCriteria: options['completion-criteria'] as string | undefined });
        else if (sub === "approve") result = approveFeature(positionals[2], home);
        else if (sub === "cancel") result = cancelFeature(positionals[2], home);
        else throw new Error("Unknown feature action");
        break;
      case "loop":
        if (sub === "start" || sub === "resume") result = startLoop(positionals[2], home);
        else if (sub === "tick") result = tickLoop(positionals[2], home);
        else if (sub === "show") result = showLoop(positionals[2], home);
        else throw new Error("Unknown loop action");
        break;
      case "run":
        if (sub === "list") result = listRuns(home);
        else if (sub === "show") result = getRun(positionals[2], home);
        else if (sub === "cancel") result = cancelRun(positionals[2], home);
        else throw new Error("Unknown run action");
        break;
      case "session":
        if (sub === "list") result = listSessions(home);
        else if (sub === "show") result = getSession(positionals[2], home);
        else if (sub === "resume") result = resumeSession(positionals[2], home);
        else throw new Error("Unknown session action");
        break;
      case "status": result = status(home); break;
      case "reconcile": result = reconcile(home); break;
      case "schedule-plan": result = schedulePlan(home); break;
      default: throw new Error(`Unknown command: ${cmd}`);
    }
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: (error as Error).message }, null, 2));
    process.exitCode = 1;
  }
}
