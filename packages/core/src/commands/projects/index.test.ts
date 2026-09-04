import { describe, expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createProject } from './create';
import { defaultProjectIdForPath } from './default-id-for-path';
import { getProject } from './get';
import { listProjects } from './list';
import { updateProject } from './update';
import { initHome, tempProjectDir } from '../../test-support/runtime';

describe('project services', () => {
  test('derives project ids from package names when no explicit id is provided', () => {
    const canonicalPath = tempProjectDir(
      'senderos-test-project',
      '@senderos/test-project',
    );
    expect(defaultProjectIdForPath(canonicalPath)).toContain(
      'senderos-test-project-',
    );
  });

  test('falls back to the directory name for malformed package metadata', () => {
    const canonicalPath = tempProjectDir('senderos-malformed-package');
    writeFileSync(join(canonicalPath, 'package.json'), '{not valid json');

    expect(defaultProjectIdForPath(canonicalPath)).toContain(
      'senderos-malformed-package-',
    );
  });

  test('creates and reads a project record', () => {
    const home = initHome();
    const canonicalPath = tempProjectDir('senderos-project-create');
    const created = createProject({
      home,
      canonicalPath,
      githubOwner: 'ajdurancr',
      githubRepo: 'senderos',
    });

    expect(created.name).toBe('senderos-project-create');
    expect(getProject(created.id, home)?.id).toBe(created.id);
  });

  test('lists stored projects in creation order', () => {
    const home = initHome();
    createProject({
      home,
      canonicalPath: tempProjectDir('senderos-project-a'),
      githubOwner: 'ajdurancr',
      githubRepo: 'senderos',
    });
    createProject({
      home,
      canonicalPath: tempProjectDir('senderos-project-b'),
      githubOwner: 'ajdurancr',
      githubRepo: 'senderos',
    });

    expect(listProjects(home)).toHaveLength(2);
    expect(listProjects(home)[0]?.name).toBe('senderos-project-a');
    expect(listProjects(home)[1]?.name).toBe('senderos-project-b');
  });

  test('updates stored project fields', () => {
    const home = initHome();
    const created = createProject({
      home,
      canonicalPath: tempProjectDir('senderos-project-update'),
      githubOwner: 'ajdurancr',
      githubRepo: 'senderos',
    });

    const updated = updateProject({
      home,
      id: created.id,
      targetBranch: 'develop',
      name: 'Updated project',
    });
    expect(updated?.targetBranch).toBe('develop');
    expect(updated?.name).toBe('Updated project');
  });

  test('throws when updating a missing project', () => {
    const home = initHome();
    expect(() =>
      updateProject({ home, id: 'project-missing', name: 'Missing' }),
    ).toThrow();
  });
});
