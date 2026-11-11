import { createContext, useCallback, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { DraftNavigationGuard } from '../../../components/draft-navigation-guard';

type DraftState = { kind: 'attempt' | 'budget'; dirty: boolean; saving: boolean };
const DraftContext = createContext<((id: string, value: DraftState | null) => void) | null>(null);

/** The inspector owns one router/document boundary for all its independent forms. */
export function InspectorDraftBoundary({ children, disabled }: { children: ReactNode; disabled: boolean }) {
  const registry = useRef<Record<string, DraftState>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const update = useCallback((id: string, value: DraftState | null) => {
    if (value) registry.current[id] = value;
    else delete registry.current[id];
    setDrafts({ ...registry.current });
  }, []);
  const isDirty = useCallback(() => Object.values(registry.current).some(draft => draft.dirty), []);
  const active = Object.values(drafts).filter(draft => draft.dirty);
  const attempt = active.some(draft => draft.kind === 'attempt');
  const budget = active.some(draft => draft.kind === 'budget');
  const subject = budget ? attempt ? 'evidence, review and execution budgets' : 'execution budgets' : 'evidence and review';
  return <DraftContext.Provider value={update}>
    {!disabled && <DraftNavigationGuard dirty={active.length > 0} isDirty={isDirty} saving={active.some(draft => draft.saving)} subject={subject} />}
    {children}
  </DraftContext.Provider>;
}

export function useInspectorDraft(kind: DraftState['kind'], dirty: boolean, saving: boolean) {
  const update = useContext(DraftContext);
  const id = useId();
  // Publish dirty state before a following navigation can observe a clean guard.
  useLayoutEffect(() => { update?.(id, { kind, dirty, saving }); }, [update, id, kind, dirty, saving]);
  useLayoutEffect(() => () => update?.(id, null), [update, id]);
}
