import { describe, expect, it } from 'vitest';
import { missionControlFixture } from '../../test-support/mission-control-fixture';
import { readDispatchReview, reviewDispatch, validateDispatchReview } from './dispatch-review';

const data = missionControlFixture;
const item = data.queue.dispatchable[0]!;
function form(items: unknown = [reviewDispatch(item)], scope: unknown = { executionContextId: 'context-1' }) {
  const value = new FormData(); value.set('reviewedItems', JSON.stringify(items)); value.set('scope', JSON.stringify(scope)); return value;
}
describe('reviewed dispatch set', () => {
  it('retains reviewed identities and scope and never adds another context', () => {
    const review = readDispatchReview(form());
    expect(validateDispatchReview(review, [item, { ...item, goalId: 'other' }], data)).toEqual([item]);
    expect(review.items[0]).toMatchObject({ goalId: item.goalId, revision: item.revision });
  });
  it('rejects stale revisions, empty sets, duplicate identities, and missing scope', () => {
    expect(() => validateDispatchReview(readDispatchReview(form()), [{ ...item, revision: item.revision + 1 }], data)).toThrow('stale');
    expect(() => readDispatchReview(form([]))).toThrow('empty');
    expect(() => readDispatchReview(form([reviewDispatch(item), reviewDispatch(item)]))).toThrow('duplicate');
    expect(() => readDispatchReview(form(undefined, null))).toThrow('scope');
    expect(() => readDispatchReview(new FormData())).toThrow();
  });
  it('rejects malformed IDs, unexpected scope properties, forged scope, and another project', () => {
    expect(() => readDispatchReview(form([{ ...item, revision: -1 }]))).toThrow('invalid');
    expect(() => readDispatchReview(form([{ ...item, goalId: '' }]))).toThrow('invalid');
    expect(() => readDispatchReview(form(undefined, { home: '/tmp' }))).toThrow('scope');
    const review = readDispatchReview(form());
    expect(() => validateDispatchReview(review, [item], data, { executionContextId: 'other' })).toThrow('scope changed');
    expect(() => validateDispatchReview({ ...review, scope: { projectId: 'other' } }, [item], data)).toThrow('outside');
  });
});
