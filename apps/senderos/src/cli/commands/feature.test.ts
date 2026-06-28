import { describe, expect, test } from 'bun:test';
import { handleFeature } from './feature';
import { initHome } from '../../../tests/helpers/runtime';

describe('handleFeature', () => {
  test('covers all feature actions and default error path', () => {
    const home = initHome();
    const created: any = handleFeature('create', [], { title: 'Feature command target' }, home);
    expect(created.title).toBe('Feature command target');
    expect((handleFeature('list', [], {}, home) as any[]).length).toBe(1);
    expect((handleFeature('show', ['feature', 'show', created.id], {}, home) as any).id).toBe(created.id);
    expect((handleFeature('update', ['feature', 'update', created.id], { title: 'Updated feature' }, home) as any).title).toBe('Updated feature');
    expect((handleFeature('approve', ['feature', 'approve', created.id], {}, home) as any).status).toBe('ready_contract');
    expect((handleFeature('cancel', ['feature', 'cancel', created.id], {}, home) as any).status).toBe('canceled');
    expect(() => handleFeature('wat', [], {}, home)).toThrow('Unknown feature action');
  });
});
