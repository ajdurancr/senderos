import { useEffect, useState } from 'react';

/** JS-only controls must not accept changes before React attaches their handlers. */
export function useClientReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
