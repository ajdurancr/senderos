import { describe, expect, test } from 'bun:test';

import { handleProject } from './project';
import {
  initHome,
  tempProjectDir,
} from '../../../core/src/test-support/runtime';

describe('project command', () => {
  test('create generates a project id from package.json name by default', async () => {
    const home = await initHome();
    const canonicalPath = tempProjectDir(
      'senderos-cli-project',
      '@acme/senderos-cli-project',
    );

    const created: any = await handleProject(
      'create',
      [],
      {
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
        'target-branch': 'main',
      },
      home,
    );

    expect(created.id).toContain('acme-senderos-cli-project-');
    expect(created.targetBranch).toBe('main');
  });

  test('create accepts an explicit project id override', async () => {
    const home = await initHome();
    const canonicalPath = tempProjectDir('senderos-cli-explicit');

    const created: any = await handleProject(
      'create',
      [],
      {
        id: 'senderos-custom-id',
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
      },
      home,
    );

    expect(created.id).toBe('senderos-custom-id');
  });

  test('list returns created projects', async () => {
    const home = await initHome();
    const canonicalPath = tempProjectDir('senderos-cli-list');
    await handleProject(
      'create',
      [],
      {
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
      },
      home,
    );

    expect((await handleProject('list', [], {}, home) as any[]).length).toBe(1);
  });

  test('show returns a stored project by id', async () => {
    const home = await initHome();
    const canonicalPath = tempProjectDir('senderos-cli-show');
    const created: any = await handleProject(
      'create',
      [],
      {
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
      },
      home,
    );

    expect(
      (await handleProject('show', ['project', 'show', created.id], {}, home) as any)
        .id,
    ).toBe(created.id);
  });

  test('update changes stored project fields', async () => {
    const home = await initHome();
    const canonicalPath = tempProjectDir('senderos-cli-update');
    const created: any = await handleProject(
      'create',
      [],
      {
        'canonical-path': canonicalPath,
        'github-owner': 'ajdurancr',
        'github-repo': 'senderos',
      },
      home,
    );

    const updated: any = await handleProject(
      'update',
      ['project', 'update', created.id],
      { name: 'Updated project', 'target-branch': 'develop' },
      home,
    );

    expect(updated.name).toBe('Updated project');
    expect(updated.targetBranch).toBe('develop');
  });

  test('unknown subcommands throw', async () => {
    const home = await initHome();
    await expect(handleProject('wat', [], {}, home)).rejects.toThrow(
      'Unknown project action',
    );
  });
});

test('project CLI registers a non-software workspace', async () => {
  const home = await initHome();
  expect(await handleProject('create', [], { name: 'Research' }, home)).toMatchObject({ name: 'Research', integrationMode: 'none', githubRemote: '' });
});

test('project CLI rejects blank names and incomplete repository edits without writes', async () => {
  const home = await initHome();
  const created: any = await handleProject('create', [], { name: 'CLI workspace' }, home);
  const args = ['project', 'update', created.id];
  await expect(handleProject('update', args, { name: '   ' }, home)).rejects.toThrow('Project name is required');
  await expect(handleProject('update', args, { 'github-owner': 'owner' }, home)).rejects.toThrow('both GitHub owner and repository');
  expect(await handleProject('show', ['project', 'show', created.id], {}, home)).toEqual(created);
  expect(await handleProject('update', args, { name: '  CLI renamed  ', 'github-owner': 'owner', 'github-repo': 'repo' }, home)).toMatchObject({ name: 'CLI renamed', githubOwner: 'owner', githubRepo: 'repo' });
});
