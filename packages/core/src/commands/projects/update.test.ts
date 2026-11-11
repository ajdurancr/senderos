import { expect, test } from 'bun:test';
import { openRuntimeDb } from '../../db/client';
import { createProjectFixture, initHome } from '../../test-support/runtime';
import { listEvents } from '../../shared/events';
import { getProject } from './get';
import { updateProject } from './update';

test('failed project event persistence rolls back settings and permits a later save', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  const db = openRuntimeDb(home);
  try {
    await db.$client.execute("CREATE TRIGGER reject_project_event BEFORE INSERT ON events WHEN NEW.event_type = 'project.updated' BEGIN SELECT RAISE(ABORT, 'project event rejected'); END");
    await expect(updateProject({ home, id: project.id, name: 'Rejected settings', targetBranch: 'release' })).rejects.toThrow('insert into');
    expect(await getProject(project.id, home)).toEqual(project);
    expect((await listEvents({ home, entityId: project.id })).filter(event => event.eventType === 'project.updated')).toHaveLength(0);
    await db.$client.execute('DROP TRIGGER reject_project_event');
    expect(await updateProject({ home, id: project.id, name: 'Saved settings' })).toMatchObject({ name: 'Saved settings', targetBranch: project.targetBranch });
  } finally { db.$client.close(); }
});

test('concurrent disjoint project settings saves preserve both changes', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  await Promise.all([
    updateProject({ home, id: project.id, name: 'Renamed project' }),
    updateProject({ home, id: project.id, targetBranch: 'release' }),
  ]);
  expect(await getProject(project.id, home)).toMatchObject({ name: 'Renamed project', targetBranch: 'release' });
  expect((await listEvents({ home, entityId: project.id })).filter(event => event.eventType === 'project.updated')).toHaveLength(2);
});
