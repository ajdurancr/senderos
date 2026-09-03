import { describe, expect, test } from 'bun:test';

import { handleProject } from './project';
import { initHome, tempProjectDir } from '../../../senderos/tests/helpers/runtime';

describe('project command', () => {
  test('create generates a project id from package.json name by default', () => {
    const home = initHome();
    const canonicalPath = tempProjectDir('senderos-cli-project', '@acme/senderos-cli-project');

    const created: any = handleProject(
      'create',
      [],
      {
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
        'target-branch': 'main',
      },
      home
    );

    expect(created.id).toContain('acme-senderos-cli-project-');
    expect(created.targetBranch).toBe('main');
  });

  test('create accepts an explicit project id override', () => {
    const home = initHome();
    const canonicalPath = tempProjectDir('senderos-cli-explicit');

    const created: any = handleProject(
      'create',
      [],
      {
        id: 'senderos-custom-id',
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
      },
      home
    );

    expect(created.id).toBe('senderos-custom-id');
  });

  test('list returns created projects', () => {
    const home = initHome();
    const canonicalPath = tempProjectDir('senderos-cli-list');
    handleProject(
      'create',
      [],
      {
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
      },
      home
    );

    expect((handleProject('list', [], {}, home) as any[]).length).toBe(1);
  });

  test('show returns a stored project by id', () => {
    const home = initHome();
    const canonicalPath = tempProjectDir('senderos-cli-show');
    const created: any = handleProject(
      'create',
      [],
      {
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
      },
      home
    );

    expect((handleProject('show', ['project', 'show', created.id], {}, home) as any).id).toBe(created.id);
  });

  test('update changes stored project fields', () => {
    const home = initHome();
    const canonicalPath = tempProjectDir('senderos-cli-update');
    const created: any = handleProject(
      'create',
      [],
      {
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
      },
      home
    );

    const updated: any = handleProject(
      'update',
      ['project', 'update', created.id],
      { name: 'Updated project', 'target-branch': 'develop' },
      home
    );

    expect(updated.name).toBe('Updated project');
    expect(updated.targetBranch).toBe('develop');
  });

  test('unknown subcommands throw', () => {
    const home = initHome();
    expect(() => handleProject('wat', [], {}, home)).toThrow('Unknown project action');
  });
});
