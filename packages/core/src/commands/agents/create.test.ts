import { expect, test } from 'bun:test';
import { initHome } from '../../test-support/runtime';
import { createAgent, updateAgent, upsertAgent } from './create';
import { getAgentBySlug } from './get-by-slug';

test('authors and updates custom instructions without replacing agent identity', async () => {
  const home = await initHome();
  const agent = await createAgent({ home, slug: 'researcher', name: 'Researcher', instructions: 'Find sources.', defaultGoal: 'Produce a sourced report.' });
  expect(agent).toMatchObject({ kind: 'custom', status: 'active', definitionBody: 'Find sources.' });
  const updated = await updateAgent({ home, id: 'researcher', instructions: 'Compare primary sources.', status: 'disabled' });
  expect(updated).toMatchObject({ id: agent.id, definitionBody: 'Compare primary sources.', status: 'disabled', defaultGoal: 'Produce a sourced report.' });
  expect(await upsertAgent({ home, slug: 'researcher', name: 'Analyst', definitionBody: 'Summarize sources.' })).toMatchObject({ id: agent.id, name: 'Analyst' });
  expect((await getAgentBySlug('researcher', home))?.definitionBody).toBe('Summarize sources.');
});

test('validates custom definitions and rejects duplicate slugs', async () => {
  const home = await initHome();
  await expect(createAgent({ home, slug: 'Bad slug', name: 'Bad', instructions: 'Hello' })).rejects.toThrow('slug');
  await expect(createAgent({ home, slug: 'empty', name: 'Empty', instructions: ' ' })).rejects.toThrow('empty');
  await expect(createAgent({ home, slug: 'empty', name: 'Empty' })).rejects.toThrow('instructions');
  await createAgent({ home, slug: 'one', name: 'One', instructions: 'Hello' });
  await createAgent({ home, slug: 'two', name: 'Two', instructions: 'Hello' });
  await expect(createAgent({ home, slug: 'one', name: 'One', instructions: 'Different' })).rejects.toThrow('already exists');
  await expect(updateAgent({ home, id: 'two', slug: 'one' })).rejects.toThrow('already exists');
  await expect(updateAgent({ home, id: 'missing', name: 'Gone' })).rejects.toThrow('not found');
  await expect(createAgent({ home, slug: 'conflict', name: 'Conflict', instructions: 'One', definitionBody: 'Two' })).rejects.toThrow('conflicting');
  await expect(updateAgent({ home, id: 'one', status: 'invalid' as never })).rejects.toThrow('status');
  await expect(createAgent({ home, slug: 'meta', name: 'Meta', instructions: 'Hi', defaultMeta: [] as never })).rejects.toThrow('object');
});

test('agent capability requirements use identifiers hosts can register', async () => {
  const home = await initHome();
  await expect(createAgent({ home, slug: 'invalid-capability', name: 'Invalid', instructions: 'Hello', defaultMeta: { requiredCapabilities: ['has spaces'] } })).rejects.toThrow('capability identifiers');
  await expect(createAgent({ home, slug: 'string-capability', name: 'Invalid', instructions: 'Hello', defaultMeta: { requiredCapabilities: '["browser"]' } })).rejects.toThrow('array');
  const agent = await createAgent({ home, slug: 'capable-agent', name: 'Capable', instructions: 'Hello', defaultMeta: { requiredCapabilities: ['browser', 'shell.exec'] } });
  await expect(updateAgent({ home, id: agent.id, defaultMeta: { requiredCapabilities: ['bad/value'] } })).rejects.toThrow('capability identifiers');
});
