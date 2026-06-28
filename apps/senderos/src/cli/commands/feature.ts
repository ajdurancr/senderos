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
  summary: 'Create a Senderos feature from an approved Gherkin contract.',
  usage: [
    'senderos feature create --project-id <project-id> --title "Add billing portal" --gherkin "Feature: ..." [--spec-text ...] [--source-request ...]',
  ],
  options: [
    { name: '--project-id', description: 'Owning project identifier.', required: true },
    { name: '--title', description: 'Feature title.', required: true },
    { name: '--gherkin', description: 'Canonical Gherkin contract text.', required: true },
    { name: '--spec-text', description: 'Approved spec text backing the feature.' },
    { name: '--source-request', description: 'Original user request or prompt.' },
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
  usage: ['senderos feature update <feature-id> [--title ...] [--spec-text ...] [--gherkin ...] [--source-request ...]'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
  options: [
    { name: '--title', description: 'New feature title.' },
    { name: '--spec-text', description: 'New approved spec text.' },
    { name: '--gherkin', description: 'New canonical Gherkin contract text.' },
    { name: '--source-request', description: 'Updated original request text.' },
  ],
};

const featureApproveHelp = {
  command: 'approve',
  summary: 'Approve a feature for implementation runs.',
  usage: ['senderos feature approve <feature-id>'],
  arguments: [{ name: 'feature-id', description: 'Feature identifier.', required: true }],
};

const featureCancelHelp = {
  command: 'cancel',
  summary: 'Cancel a feature, its active run, and cleanup-related state.',
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
    projectId: String(options['project-id'] ?? ''),
    title: String(options.title ?? ''),
    specText: String(options['spec-text'] ?? ''),
    sourceRequestText: String(options['source-request'] ?? ''),
    gherkinText: String(options.gherkin ?? ''),
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
    specText: options['spec-text'] as string | undefined,
    sourceRequestText: options['source-request'] as string | undefined,
    gherkinText: options.gherkin as string | undefined,
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
