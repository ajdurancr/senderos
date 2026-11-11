import { expect, test } from 'bun:test';
import { createProjectFixture, initHome } from '../../test-support/runtime';
import { listEvents } from '../../shared/events';
import { getProject } from './get';
import { updateProject } from './update';

for (const [label, fields, message] of [
  ['blank display name', { name: '   ' }, 'Project name is required'],
  ['unpaired repository identity', { githubOwner: '' }, 'both GitHub owner and repository'],
] as const) {
  test(`project updates reject ${label} without changing the record or event history`, async () => {
    const home = await initHome();
    const project = await createProjectFixture(home);
    const events = await listEvents({ home, entityId: project.id });
    await expect(updateProject({ home, id: project.id, ...fields })).rejects.toThrow(message);
    expect(await getProject(project.id, home)).toEqual(project);
    expect(await listEvents({ home, entityId: project.id })).toEqual(events);
  });
}

test('a standalone project cannot gain half of a GitHub identity', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home, { githubOwner: '', githubRepo: '', integrationMode: 'none' });
  await expect(updateProject({ home, id: project.id, githubRepo: 'repo' })).rejects.toThrow('both GitHub owner and repository');
  expect(await getProject(project.id, home)).toEqual(project);
});

test('updates normalize supplied names and identity fields while preserving omitted counterparts', async () => {
  const home = await initHome();
  const project = await createProjectFixture(home);
  expect(await updateProject({ home, id: project.id, name: '  Renamed workspace  ', githubOwner: '  new-owner  ' })).toMatchObject({ name: 'Renamed workspace', githubOwner: 'new-owner', githubRepo: project.githubRepo });
  expect(await updateProject({ home, id: project.id, githubOwner: ' ', githubRepo: ' ', integrationMode: 'none' })).toMatchObject({ name: 'Renamed workspace', githubOwner: '', githubRepo: '', integrationMode: 'none' });
});
