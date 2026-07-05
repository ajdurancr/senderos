import { describe, expect, test } from 'bun:test';
import { handlePlan } from './plan';
import { approveFeature, createFeature } from '../../services/runtime';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('plan command', () => {
  test('returns dispatchable planning items', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    approveFeature(createFeature({ home, projectId: project.id, title: 'Plan target', gherkinText: 'Feature: Plan target' }).id, home);
    const items: any[] = handlePlan({}, home) as any[];
    expect(items.length).toBeGreaterThan(0);
    expect(Object.keys(items[0]!).sort()).toEqual(['agentId', 'featureId', 'previousRunId', 'senderoId']);
  });

  test('accepts repeated feature-status filters', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    approveFeature(createFeature({ home, projectId: project.id, title: 'Plan target', gherkinText: 'Feature: Plan target' }).id, home);
    const items: any[] = handlePlan({ 'feature-status': ['active', 'failed'] }, home) as any[];
    expect(Array.isArray(items)).toBe(true);
  });
});
