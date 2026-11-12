import { useEffect, useLayoutEffect, useRef } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router';

/** One boundary for scope/history navigation and document links/reloads. */
export function DraftNavigationGuard({ dirty, saving, subject = 'graph', allowNavigation, isDirty }: { dirty: boolean; saving: boolean; subject?: 'graph' | 'new workflow' | 'new goal' | 'goal' | 'agent' | 'project settings' | 'workspace setup' | 'evidence and review' | 'execution budgets' | 'evidence, review and execution budgets'; allowNavigation?: (pathname: string, search: string) => boolean; isDirty?: () => boolean }) {
  // Shared form registries can publish a dirty snapshot before their render commits.
  const hasDraft = () => isDirty?.() ?? dirty;
  // Router updates blocker functions in a passive effect. A navigation at the
  // save/draft commit can still call the previous function, so consult the
  // latest committed policy instead of that function's captured render.
  const policy = useRef({ dirty, isDirty, allowNavigation });
  useLayoutEffect(() => { policy.current = { dirty, isDirty, allowNavigation }; });
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (policy.current.isDirty?.() ?? policy.current.dirty) && !policy.current.allowNavigation?.(nextLocation.pathname, nextLocation.search) && (
    currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search
  ));
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useBeforeUnload(event => {
    if (!hasDraft()) return;
    event.preventDefault();
    event.returnValue = '';
  });
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    stay.current?.focus();
    return () => {
      dialog.current?.close();
      returnFocus?.focus();
    };
  }, [blocker.state]);
  if (blocker.state !== 'blocked') return null;
  return <dialog ref={dialog} className="draft-navigation-dialog" aria-labelledby="draft-navigation-title" aria-describedby="draft-navigation-description" onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button');
    const first = buttons?.[0]; const last = buttons?.[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onCancel={event => { event.preventDefault(); blocker.reset(); }}>
    <h2 id="draft-navigation-title">Leave {subject} editor?</h2>
    <p id="draft-navigation-description">{saving
      ? subject === 'new workflow'
        ? 'Workflow creation or import is in progress. Leaving may interrupt its confirmation. The draft may still be created; inspect persisted Senderos before submitting again.'
        : subject === 'new goal'
        ? 'Goal creation is in progress. Leaving may interrupt its confirmation. The goal may still be created; inspect persisted goals before creating again.'
        : subject === 'execution budgets' || subject === 'evidence, review and execution budgets'
        ? 'A submission is in progress. Leaving may interrupt its confirmation. It may still finish; inspect persisted execution budgets, evidence and the current review before submitting again.'
        : subject === 'evidence and review'
        ? 'A submission is in progress. Leaving may interrupt its confirmation. It may still finish; inspect persisted evidence and the current review before submitting again.'
        : subject === 'workspace setup'
        ? 'A save is in progress. Leaving may interrupt its confirmation. The save may still finish; inspect saved settings and workspace identities before editing again.'
        : 'A save is in progress. Leaving may interrupt its confirmation. The save may still finish; check the saved draft before editing again.'
      : hasDraft() ? `Your ${subject} edits are unsaved. Stay here to save or cancel your changes. Leaving discards the edits in this editor.`
        : `Your ${subject} edits are now saved. You can continue to the selected page.`}</p>
    <footer><button ref={stay} type="button" className="button button-secondary" onClick={() => blocker.reset()}>Stay here</button><button type="button" className="button button-danger" onClick={() => blocker.proceed()}>Leave editor</button></footer>
  </dialog>;
}
