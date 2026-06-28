import { describe, expect, test } from 'bun:test';

import { handleProject } from './project';
import { initHome, tempProjectDir } from '../../../tests/helpers/runtime';

describe('handleProject', () => {
  test('covers create, list, show, update, and default error path', () => {
    const home = initHome();
    const canonicalPath = tempProjectDir('senderos-cli-project');
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

    expect(created.id).toContain('senderos-cli-project-');
    expect((handleProject('list', [], {}, home) as any[]).length).toBe(1);
    expect((handleProject('show', ['project', 'show', created.id], {}, home) as any).id).toBe(created.id);
    expect(
      (handleProject('update', ['project', 'update', created.id], { name: 'Updated project' }, home) as any)
        .name
    ).toBe('Updated project');
    expect(() => handleProject('wat', [], {}, home)).toThrow('Unknown project action');
  });
});
