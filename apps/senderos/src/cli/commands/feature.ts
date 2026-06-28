import {
  approveFeature,
  cancelFeature,
  createFeature,
  getFeature,
  listFeatures,
  updateFeature,
} from '../../services/runtime';
import { requirePositional } from '../shared';

const featureCreateHelp = {
  command: 'create',
  summary: 'Create a Senderos feature.',
  usage: ['senderos feature create --title "Add billing portal" [--problem-statement ...] [--contract ...] [--completion-criteria ...]'],
  options: [
    { name: '--title', description: 'Feature title.', required: true },
    { name: '--problem-statement', description: 'Problem statement for the feature.' },
    { name: '--contract', description: 'Initial contract text.' },
    { name: '--completion-criteria', description: 'Completion criteria for the feature.' },
  ],
};

const featureListHelp = {
  command: 'list',
  summary: 'List Senderos features.',
  usage: ['senderos feature list'],
};

const featureShowHelp = {
  command: 'show',
  summary: 'Show a Senderos feature.',
  usage: ['senderos feature show <feature-id>'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
};

const featureUpdateHelp = {
  command: 'update',
  summary: 'Update a Senderos feature.',
  usage: ['senderos feature update <feature-id> [--title ...] [--problem-statement ...] [--contract ...] [--completion-criteria ...]'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
  options: [
    { name: '--title', description: 'New feature title.' },
    { name: '--problem-statement', description: 'New problem statement.' },
    { name: '--contract', description: 'New contract text.' },
    { name: '--completion-criteria', description: 'New completion criteria.' },
  ],
};

const featureApproveHelp = {
  command: 'approve',
  summary: 'Approve a feature for loop execution.',
  usage: ['senderos feature approve <feature-id>'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
};

const featureCancelHelp = {
  command: 'cancel',
  summary: 'Cancel a feature and remaining active tasks.',
  usage: ['senderos feature cancel <feature-id>'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
};

export const featureCommandHelp = {
  command: 'feature',
  summary: 'Create and manage Senderos features.',
  usage: ['senderos feature <create|list|show|update|approve|cancel> ...'],
  subcommands: [
    featureCreateHelp,
    featureListHelp,
    featureShowHelp,
    featureUpdateHelp,
    featureApproveHelp,
    featureCancelHelp,
  ],
};

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

export function handleFeature(
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
