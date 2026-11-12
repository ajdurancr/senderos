import { useLayoutEffect, useRef, type FormEvent } from 'react';
import { useActionData, useNavigation } from 'react-router';

/** An uncertain response requires persisted-state readback, never automatic replay. */
export function useExecutionSubmission(intent: 'start' | 'dispatch-plan' | 'cancel-goal' | 'create-goal') {
  const action = useActionData<{ intent?: string; transportFailure?: boolean }>();
  const pending = useNavigation().state !== 'idle';
  const submitted = useRef(false);
  // Fragment navigation can clear action data without running a loader. Keep
  // uncertainty latched for this mounted action until document readback; losing
  // router feedback is not confirmation that the mutation did not happen.
  const uncertainty = useRef(false);
  if (action?.intent === intent && action.transportFailure === true) uncertainty.current = true;
  const uncertain = uncertainty.current;
  // Release the synchronous double-submit latch before the enabled DOM can
  // accept another input. A passive effect leaves an enabled-but-blocked window
  // after a known rejection. Uncertainty remains independently latched above.
  useLayoutEffect(() => { if (!pending) submitted.current = false; }, [pending, action]);
  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending || uncertain || submitted.current) { event.preventDefault(); return; }
    submitted.current = true;
  }
  return { pending, uncertain, submit };
}
