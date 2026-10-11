import type { MissionControlData } from './server';

export type DispatchScope = { executionContextId?: string; projectId?: string };
export type ReviewedDispatch = {
  goalId: string;
  activationId: string;
  revision: number;
  agentId: string;
  transitionId: string;
  previousRunId?: string | null;
};

type PlanItem = MissionControlData['queue']['dispatchable'][number];

export function reviewDispatch(item: PlanItem): ReviewedDispatch {
  return {
    goalId: item.goalId,
    activationId: item.activationId,
    revision: item.revision,
    agentId: item.agentId,
    transitionId: item.transitionId,
    previousRunId: item.previousRunId ?? null,
  };
}

export function readDispatchReview(form: FormData): { scope: DispatchScope; items: ReviewedDispatch[] } {
  let scope: unknown;
  let items: unknown;
  try {
    scope = JSON.parse(String(form.get('scope')));
    items = JSON.parse(String(form.get('reviewedItems')));
  } catch {
    throw new Error('The reviewed dispatch plan is missing or invalid. Refresh the plan before dispatching.');
  }
  if (!scope || typeof scope !== 'object' || Array.isArray(scope) ||
      Object.keys(scope).some(key => !['executionContextId', 'projectId'].includes(key)) ||
      Object.values(scope).some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('A valid dispatch scope is required. Refresh the plan before dispatching.');
  }
  if (!Array.isArray(items) || !items.length || items.some(item =>
    !item || typeof item !== 'object' ||
    !['goalId', 'activationId', 'agentId', 'transitionId'].every(key => typeof item[key] === 'string' && item[key].length > 0) ||
    !Number.isSafeInteger(item.revision) || item.revision < 0 ||
    (item.activationId !== undefined && (typeof item.activationId !== 'string' || !item.activationId)) ||
    (item.previousRunId != null && typeof item.previousRunId !== 'string'))) {
    throw new Error('The reviewed dispatch plan is empty or invalid. Refresh the plan before dispatching.');
  }
  const ids = items.map(item => item.activationId ?? `${item.goalId}:${item.transitionId}`);
  if (new Set(ids).size !== ids.length) throw new Error('The reviewed dispatch plan contains duplicate activations.');
  return { scope: scope as DispatchScope, items: items as ReviewedDispatch[] };
}

export function validateDispatchReview(
  review: { scope: DispatchScope; items: ReviewedDispatch[] },
  current: PlanItem[],
  data: Pick<MissionControlData, 'projects' | 'goals'>,
  requestScope?: DispatchScope,
): PlanItem[] {
  if (requestScope && (review.scope.executionContextId !== requestScope.executionContextId || review.scope.projectId !== requestScope.projectId)) {
    throw new Error('The dispatch scope changed. Refresh the plan before dispatching.');
  }
  const projects = new Set(data.projects.filter(project =>
    (!review.scope.executionContextId || project.executionContextId === review.scope.executionContextId) &&
    (!review.scope.projectId || project.id === review.scope.projectId)).map(project => project.id));
  const goals = new Set(data.goals.filter(goal => projects.has(goal.projectId)).map(goal => goal.id));
  const visible = current.filter(item => goals.has(item.goalId));
  const identity = (item: ReviewedDispatch) => JSON.stringify(reviewDispatch(item as PlanItem));
  const currentByIdentity = new Map(visible.map(item => [identity(item), item]));
  if (visible.length !== review.items.length || review.items.some(item => !goals.has(item.goalId) || !currentByIdentity.has(identity(item)))) {
    throw new Error('The dispatch plan is stale or outside the reviewed scope. Refresh and review it again. No new work was reserved.');
  }
  return review.items.map(item => currentByIdentity.get(identity(item))!);
}
