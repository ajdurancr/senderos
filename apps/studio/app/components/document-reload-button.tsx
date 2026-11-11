import type { ReactNode } from 'react';

/** Reload persisted state without replaying the previous action or changing scope. */
export function DocumentReloadButton({ children, className = 'button button-secondary' }: { children: ReactNode; className?: string }) {
  return <button type="button" className={className} onClick={() => window.location.reload()}>{children}</button>;
}
