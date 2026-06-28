import {
  approveFeature,
  cancelFeature,
  createFeature,
  getFeature,
  listFeatures,
  updateFeature,
} from '../../services/runtime';
import { requirePositional } from '../shared';

export const featureCommandHelp = {
  command: 'feature',
  summary: 'Create and manage Senderos features.',
  usage: [
    'senderos feature create --title "Add billing portal"',
    'senderos feature list',
    'senderos feature approve <feature-id>',
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
