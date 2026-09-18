import { expect, test } from 'bun:test';
import { handleTransition } from './transition';
import { createAgentTransition, getAgentBySlug } from '@senderos/core';
import { initHome } from '../../../core/src/test-support/runtime';

test('transition command creates and retrieves a handoff', async () => {
  const home = await initHome();
  const agent = (await getAgentBySlug('spec-partner', home))!;
  const transition = await createAgentTransition({ home, sourceAgentId: agent.id, name: 'CLI handoff', transitionObjective: 'Review the result.' });
  expect(await handleTransition('show', ['transition', 'show', transition.id], {}, home)).toMatchObject({ id: transition.id });
  expect(await handleTransition('list', [], { 'agent-id': agent.id }, home)).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: transition.id })]),
  );
});

test('transition command lists all transitions and rejects unknown actions', async () => {
  const home = await initHome();
  expect(await handleTransition('list', [], {}, home)).toBeArray();
  await expect(handleTransition('invalid-action', [], {}, home)).rejects.toThrow(
    'Unknown transition action',
  );
});
