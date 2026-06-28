import { describe, expect, test } from 'bun:test';

import { createProject, defaultProjectIdForPath, getProject, listProjects, updateProject } from './projects';
import { initHome, tempProjectDir } from '../../../tests/helpers/runtime';

describe('project services', () => {
  test('creates, reads, lists, updates, and derives project ids from package names', () => {
    const home = initHome();
    const canonicalPath = tempProjectDir('senderos-test-project', '@senderos/test-project');
    expect(defaultProjectIdForPath(canonicalPath)).toContain('senderos-test-project-');

    const created = createProject({
      home,
      canonicalPath,
      githubOwner: 'ajdurancr',
      githubRepo: 'senderos',
    });

    expect(created.name).toBe('@senderos/test-project');
    expect(getProject(created.id, home)?.id).toBe(created.id);
    expect(listProjects(home)).toHaveLength(1);
    expect(updateProject({ home, id: created.id, targetBranch: 'develop' })?.targetBranch).toBe('develop');
    expect(() => updateProject({ home, id: 'project-missing', name: 'Missing' })).toThrow();
  });
});
