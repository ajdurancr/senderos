import { useEffect, useRef, type FormEvent } from 'react';
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
  useEffect(() => { if (!pending) submitted.current = false; }, [pending, action]);
  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending || uncertain || submitted.current) { event.preventDefault(); return; }
    submitted.current = true;
  }
  return { pending, uncertain, submit };
}
