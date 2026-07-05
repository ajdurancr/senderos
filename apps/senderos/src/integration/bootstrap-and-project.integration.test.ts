import { afterAll, afterEach, describe, expect, test } from 'bun:test';

import { cleanupIntegrationRunRoot, cleanupIntegrationTemps, cli, createTempProject, openDb, tempDir } from './helpers';

afterEach(cleanupIntegrationTemps);
afterAll(cleanupIntegrationRunRoot);

describe('integration: bootstrap and project cli', () => {
  test('initializes runtime and manages project records through the cli', () => {
    const home = tempDir('senderos-int-home');
    const projectRoot = createTempProject({ packageName: '@acme/senderos-smoke' });

    const initResult: any = cli(['init', '--home', home, '--harness', 'codex', '--approve']);
    expect(initResult.home).toBe(home);

    const seedDb = openDb(home);
    const seededAgent = seedDb.query("select slug from agents where slug='spec-partner'").get() as
      | { slug: string }
      | null;
    expect(seededAgent?.slug).toBe('spec-partner');
    seedDb.close();

    const doctor: any = cli(['doctor', '--home', home]);
    expect(doctor.ok).toBe(true);

    const createdProject: any = cli([
      'project',
      'create',
      '--home',
      home,
      '--canonical-path',
      projectRoot,
      '--github-owner',
      'ajdurancr',
      '--github-repo',
      'senderos',
      '--target-branch',
      'main',
      '--build-command',
      'bun run build',
      '--test-command',
      'bun run test',
      '--lint-command',
      'bun run lint',
    ]);

    expect(createdProject.id).toContain('acme-senderos-smoke-');
    expect(createdProject.name).toBe('@acme/senderos-smoke');

    const listedProjects: any[] = cli(['project', 'list', '--home', home]);
    expect(listedProjects).toHaveLength(1);
    expect(listedProjects[0].id).toBe(createdProject.id);

    const shownProject: any = cli(['project', 'show', createdProject.id, '--home', home]);
    expect(shownProject.canonicalPath).toBe(projectRoot);

    const updatedProject: any = cli([
      'project',
      'update',
      createdProject.id,
      '--home',
      home,
      '--target-branch',
      'develop',
      '--name',
      'Updated smoke project',
    ]);
    expect(updatedProject.targetBranch).toBe('develop');
    expect(updatedProject.name).toBe('Updated smoke project');

    const status: any = cli(['status', '--home', home]);
    expect(status.projects.total).toBe(1);
    expect(status.projects.unhealthy).toBe(0);

    const db = openDb(home);
    const events = db.query("select event_type from events where entity_type='project' order by created_at asc").all() as Array<{ event_type: string }>;
    expect(events.map((row) => row.event_type)).toEqual(['project.created', 'project.updated']);
    db.close();
  });
});
