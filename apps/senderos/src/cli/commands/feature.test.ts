import { describe, expect, test } from 'bun:test';
import { handleFeature } from './feature';
import { createProjectFixture, initHome } from '../../../tests/helpers/runtime';

describe('feature command', () => {
  test('create stores a new feature', () => {
    const home = initHome();
    const project = createProjectFixture(home);

    const created: any = handleFeature(
      'create',
      [],
      {
        'project-id': project.id,
        title: 'Feature command target',
        gherkin: 'Feature: Feature command target',
      },
      home
    );

    expect(created.title).toBe('Feature command target');
    expect(created.status).toBe('awaiting_scenario_approval');
  });

  test('list returns stored features', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    handleFeature('create', [], { 'project-id': project.id, title: 'Feature one', gherkin: 'Feature: One' }, home);

    expect((handleFeature('list', [], {}, home) as any[]).length).toBe(1);
  });

  test('show returns a stored feature', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const created: any = handleFeature('create', [], { 'project-id': project.id, title: 'Feature one', gherkin: 'Feature: One' }, home);

    expect((handleFeature('show', ['feature', 'show', created.id], {}, home) as any).id).toBe(created.id);
  });

  test('update changes stored feature fields', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const created: any = handleFeature('create', [], { 'project-id': project.id, title: 'Feature one', gherkin: 'Feature: One' }, home);

    expect(
      (handleFeature('update', ['feature', 'update', created.id], { title: 'Updated feature' }, home) as any).title
    ).toBe('Updated feature');
  });

  test('approve marks a feature active', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const created: any = handleFeature('create', [], { 'project-id': project.id, title: 'Feature one', gherkin: 'Feature: One' }, home);

    expect((handleFeature('approve', ['feature', 'approve', created.id], {}, home) as any).status).toBe('active');
  });

  test('cancel marks a feature canceled', () => {
    const home = initHome();
    const project = createProjectFixture(home);
    const created: any = handleFeature('create', [], { 'project-id': project.id, title: 'Feature one', gherkin: 'Feature: One' }, home);

    expect((handleFeature('cancel', ['feature', 'cancel', created.id], {}, home) as any).status).toBe('canceled');
  });

  test('unknown subcommands throw', () => {
    const home = initHome();
    expect(() => handleFeature('wat', [], {}, home)).toThrow('Unknown feature action');
  });
});
