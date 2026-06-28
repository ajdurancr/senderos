import { describe, expect, test } from 'bun:test';
import { defaultInstruction } from './instructions';

describe('defaultInstruction', () => {
  test('returns phase-specific objectives', () => {
    const feature: any = {
      id: 'f',
      projectId: 'p',
      title: 'Title',
      baseTargetBranch: 'main',
      featureBranchName: null,
      gherkinText: 'Feature: Title',
    };
    expect(defaultInstruction(feature, 'implementation').objective).toContain('Gherkin contract');
    expect(defaultInstruction(feature, 'implementation').gherkinText).toBe('Feature: Title');
    expect(defaultInstruction(feature, 'review').objective).toContain('mutation testing');
    expect(defaultInstruction(feature, 'mutation').objective).toContain('mutation-confidence');
    expect(defaultInstruction(feature, 'done').objective).toBe('No further work required.');
  });
});
