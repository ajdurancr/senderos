import { useEffect, useRef, type FormEvent } from 'react';
import { useActionData, useNavigation } from 'react-router';

/** An uncertain response requires persisted-state readback, never automatic replay. */
export function useExecutionSubmission(intent: 'dispatch-plan' | 'cancel-goal') {
  const action = useActionData<{ intent?: string; transportFailure?: boolean }>();
  const pending = useNavigation().state !== 'idle';
  const submitted = useRef(false);
  const uncertain = action?.intent === intent && action.transportFailure === true;
  useEffect(() => { if (!pending) submitted.current = false; }, [pending, action]);
  function submit(event: FormEvent<HTMLFormElement>) {
    if (pending || uncertain || submitted.current) { event.preventDefault(); return; }
    submitted.current = true;
  }
  return { pending, uncertain, submit };
}
