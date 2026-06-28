import { resolve } from 'node:path';

import type { HarnessKind } from '../domain/types';
import { defaultHomePath, initializeRuntime, loadConfig, previewInit } from '../config/runtime';
import { getRun, getSession } from '../services/loop';
import {
  approveFeature,
  cancelFeature,
  createFeature,
  getFeature,
  listFeatures,
  updateFeature,
} from '../services/runtime/features';
import {
  cancelRun,
  doctor,
  getConfigPath,
  listRuns,
  listSessions,
  reconcile,
  resumeSession,
  schedulePlan,
  showLoop,
  startLoop,
  status,
  tickLoop,
  updateConfigPath,
} from '../services/runtime/operations';
import { parseArgs } from './args';

function resolveHome(optionHome: string | boolean | undefined) {
  return resolve(String(optionHome ?? defaultHomePath()));
}

function requirePositional(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }

  return value;
}

function parseFeatureCreateOptions(home: string, options: Record<string, string | boolean>) {
  return {
    home,
    title: String(options.title ?? ''),
    problemStatement: String(options['problem-statement'] ?? ''),
    contractText: String(options.contract ?? ''),
    completionCriteria: String(options['completion-criteria'] ?? ''),
  };
}

function parseFeatureUpdateOptions(
  home: string,
  id: string,
  options: Record<string, string | boolean>
) {
  return {
    home,
    id,
    title: options.title as string | undefined,
    problemStatement: options['problem-statement'] as string | undefined,
    contractText: options.contract as string | undefined,
    completionCriteria: options['completion-criteria'] as string | undefined,
  };
}

async function handleInit(options: Record<string, string | boolean>) {
  const preview = previewInit(
    options.home as string | undefined,
    options.harness as HarnessKind | undefined
  );

  if (!options.approve) {
    return preview;
  }

  if (!options.harness && preview.inferredHarness === 'unknown') {
    throw new Error(
      'Harness is not known. Re-run with --harness <openclaw|codex|claude-code> and --approve.'
    );
  }

  return initializeRuntime(preview.home, preview.config);
}

function handleConfig(sub: string | undefined, positionals: string[], home: string) {
  switch (sub) {
    case 'show':
      return loadConfig(home);
    case 'get': {
      const path = requirePositional(positionals[2], 'config path');
      return { path, value: getConfigPath(path, home) };
    }
    case 'set': {
      const path = requirePositional(positionals[2], 'config path');
      const value = requirePositional(positionals[3], 'config value');
      return updateConfigPath(path, value, home);
    }
    default:
      throw new Error('Unknown config action');
  }
}

function handleFeature(
  sub: string | undefined,
  positionals: string[],
  options: Record<string, string | boolean>,
  home: string
) {
  switch (sub) {
    case 'create':
      return createFeature(parseFeatureCreateOptions(home, options));
    case 'list':
      return listFeatures(home);
    case 'show':
      return getFeature(requirePositional(positionals[2], 'feature id'), home);
    case 'update':
      return updateFeature(
        parseFeatureUpdateOptions(home, requirePositional(positionals[2], 'feature id'), options)
      );
    case 'approve':
      return approveFeature(requirePositional(positionals[2], 'feature id'), home);
    case 'cancel':
      return cancelFeature(requirePositional(positionals[2], 'feature id'), home);
    default:
      throw new Error('Unknown feature action');
  }
}

function handleLoop(sub: string | undefined, positionals: string[], home: string) {
  const featureId = requirePositional(positionals[2], 'feature id');

  switch (sub) {
    case 'start':
    case 'resume':
      return startLoop(featureId, home);
    case 'tick':
      return tickLoop(featureId, home);
    case 'show':
      return showLoop(featureId, home);
    default:
      throw new Error('Unknown loop action');
  }
}

function handleRun(sub: string | undefined, positionals: string[], home: string) {
  switch (sub) {
    case 'list':
      return listRuns(home);
    case 'show':
      return getRun(requirePositional(positionals[2], 'run id'), home);
    case 'cancel':
      return cancelRun(requirePositional(positionals[2], 'run id'), home);
    default:
      throw new Error('Unknown run action');
  }
}

function handleSession(sub: string | undefined, positionals: string[], home: string) {
  switch (sub) {
    case 'list':
      return listSessions(home);
    case 'show':
      return getSession(requirePositional(positionals[2], 'session id'), home);
    case 'resume':
      return resumeSession(requirePositional(positionals[2], 'session id'), home);
    default:
      throw new Error('Unknown session action');
  }
}

export async function runCli(argv = process.argv.slice(2)) {
  const { positionals, options } = parseArgs(argv);
  const cmd = positionals[0];
  const sub = positionals[1];
  const home = resolveHome(options.home);

  try {
    let result: unknown;

    switch (cmd) {
      case 'init':
        result = await handleInit(options);
        break;
      case 'doctor':
        result = doctor(home);
        break;
      case 'config':
        result = handleConfig(sub, positionals, home);
        break;
      case 'feature':
        result = handleFeature(sub, positionals, options, home);
        break;
      case 'loop':
        result = handleLoop(sub, positionals, home);
        break;
      case 'run':
        result = handleRun(sub, positionals, home);
        break;
      case 'session':
        result = handleSession(sub, positionals, home);
        break;
      case 'status':
        result = status(home);
        break;
      case 'reconcile':
        result = reconcile(home);
        break;
      case 'schedule-plan':
        result = schedulePlan(home);
        break;
      default:
        throw new Error(`Unknown command: ${cmd}`);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ error: (error as Error).message }, null, 2));
    process.exitCode = 1;
  }
}
